// Código de confirmação por e-mail (cadastro e troca de senha), guardado no banco.
//
// Antes: o código ficava na memória do processo (sumia ao reiniciar e não valia em outra
// réplica), era gerado com Math.random, não tinha limite de tentativas e a ação
// "enviar_legado" deixava o próprio cliente escolher o código — o que permitia confirmar
// qualquer e-mail e trocar a senha de qualquer conta.
import { createHash } from 'node:crypto'
import { gerarCodigo, gerarTokenAleatorio, segredoJwt } from '../auth.mjs'
import { pool } from '../migrar.mjs'

const OTP_MINUTOS = 10
const TOKEN_MINUTOS = 15
const COOLDOWN_SEGUNDOS = 60
const MAX_TENTATIVAS = 5

export function montarEmailCodigo(finalidade, codigo) {
  const acao =
    finalidade === 'cadastro'
      ? 'confirmar seu e-mail e concluir o cadastro'
      : 'redefinir sua senha no portal'
  const assunto =
    finalidade === 'cadastro'
      ? 'Doca Livre fazumfreela - código de confirmação de e-mail'
      : 'Doca Livre fazumfreela - código para trocar a senha'
  const texto =
    `Seu código Doca Livre fazumfreela é: ${codigo}\n\n` +
    `Use este código para ${acao}.\n` +
    `Ele vale por ${OTP_MINUTOS} minutos.\n\n` +
    'Se você não solicitou, ignore este e-mail.'
  const html =
    '<p>Seu código Doca Livre fazumfreela é:</p>' +
    `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${codigo}</p>` +
    `<p>Use este código para ${acao}. Vale por ${OTP_MINUTOS} minutos.</p>` +
    '<p style="color:#64748b;font-size:13px">Se você não solicitou, ignore este e-mail.</p>'
  return { assunto, texto, html }
}

function hashCodigo(codigo) {
  return createHash('sha256').update(`${segredoJwt()}:otp:${codigo}`).digest('hex')
}

function emailValido(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

async function enviarResend(email, codigo, finalidade) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. O envio ainda não está configurado neste ambiente.',
    }
  }
  const from =
    String(process.env.RESEND_FROM || '').trim() ||
    String(process.env.SMTP_FROM || '').trim() ||
    'Doca Livre fazumfreela <onboarding@resend.dev>'
  const { assunto, texto, html } = montarEmailCodigo(finalidade, codigo)
  try {
    const resposta = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ from, to: [email], subject: assunto, text: texto, html }),
    })
    if (resposta.status === 200 || resposta.status === 201) return { ok: true, status: 200 }
    // O motivo do Resend (domínio não verificado, limite, chave inválida) só vai para o log do
    // servidor; quem pediu o código recebe a mensagem genérica.
    const detalhe = await resposta.text().catch(() => '')
    console.error(`[email] Resend recusou o código (${resposta.status}), remetente ${from}: ${detalhe.slice(0, 400)}`)
  } catch (erro) {
    console.error(`[email] Falha ao falar com o Resend: ${erro?.message || erro}`)
  }
  return { ok: false, status: 503, erro: 'Não foi possível enviar o e-mail. Tente de novo em instantes.' }
}

async function contaPorIdentificador(identificador) {
  const chave = String(identificador || '').trim().toLowerCase()
  if (!chave) return null
  const { rows } = await pool.query(
    `select id, email, ativo from mao_contas where lower(email) = $1 or lower(usuario) = $1 limit 1`,
    [chave],
  )
  return rows[0] || null
}

async function enviar({ email, identificador, finalidade, portalRole }) {
  let destino = String(email || '').trim().toLowerCase()
  if (finalidade === 'senha') {
    const conta = await contaPorIdentificador(identificador || email)
    if (!conta || !conta.ativo) return { ok: false, status: 404, erro: 'Usuário ou e-mail não encontrado.' }
    destino = String(conta.email).toLowerCase()
  } else {
    if (!destino || !emailValido(destino)) return { ok: false, status: 400, erro: 'Informe um e-mail válido.' }
    const existe = await pool.query(`select 1 from mao_contas where lower(email) = $1 limit 1`, [destino])
    if (existe.rowCount) return { ok: false, status: 409, erro: 'Este e-mail já está sendo utilizado.' }
  }

  const recente = await pool.query(
    `select 1 from mao_email_codigos
     where lower(email) = $1 and finalidade = $2 and not usado
       and created_at > now() - make_interval(secs => $3)
     limit 1`,
    [destino, finalidade, COOLDOWN_SEGUNDOS],
  )
  if (recente.rowCount) {
    return { ok: false, status: 429, erro: 'Aguarde cerca de 1 minuto para pedir outro código.' }
  }

  const codigo = gerarCodigo()
  // Um código novo invalida os anteriores do mesmo e-mail.
  await pool.query(`update mao_email_codigos set usado = true where lower(email) = $1 and finalidade = $2 and not usado`, [
    destino,
    finalidade,
  ])
  const papel = finalidade === 'cadastro' && (portalRole === 'empresa' || portalRole === 'profissional') ? portalRole : null
  const { rows } = await pool.query(
    `insert into mao_email_codigos (finalidade, email, codigo_hash, expira_em, portal_role)
     values ($1, $2, $3, now() + make_interval(mins => $4), $5) returning id`,
    [finalidade, destino, hashCodigo(codigo), OTP_MINUTOS, papel],
  )
  const enviado = await enviarResend(destino, codigo, finalidade)
  if (!enviado.ok) {
    await pool.query(`delete from mao_email_codigos where id = $1`, [rows[0].id])
    return enviado
  }
  return { ok: true, status: 200, email: destino }
}

async function verificar({ email, identificador, codigo, finalidade }) {
  const digitos = String(codigo || '').replace(/\D/g, '')
  let destino = String(email || '').trim().toLowerCase()
  if (finalidade === 'senha' && !destino) {
    const conta = await contaPorIdentificador(identificador)
    destino = conta ? String(conta.email).toLowerCase() : ''
  }
  if (!destino || digitos.length !== 6) return { ok: false, status: 400, erro: 'Código inválido ou expirado.' }
  const { rows } = await pool.query(
    `select id, codigo_hash, tentativas, portal_role from mao_email_codigos
     where lower(email) = $1 and finalidade = $2 and not usado and expira_em > now()
     order by created_at desc limit 1`,
    [destino, finalidade],
  )
  const rec = rows[0]
  if (!rec) return { ok: false, status: 400, erro: 'Código inválido ou expirado.' }
  if (rec.tentativas >= MAX_TENTATIVAS) {
    return { ok: false, status: 429, erro: 'Muitas tentativas erradas. Peça um novo código.' }
  }
  if (rec.codigo_hash !== hashCodigo(digitos)) {
    await pool.query(`update mao_email_codigos set tentativas = tentativas + 1 where id = $1`, [rec.id])
    return { ok: false, status: 400, erro: 'Código inválido ou expirado.' }
  }
  const token = gerarTokenAleatorio('vt')
  await pool.query(
    `update mao_email_codigos set verify_token = $2, token_expira_em = now() + make_interval(mins => $3) where id = $1`,
    [rec.id, token, TOKEN_MINUTOS],
  )
  return { ok: true, status: 200, verify_token: token, portalRole: rec.portal_role || null, email: destino }
}

/**
 * Usa (uma vez só) o token de e-mail confirmado. Chamado pelo servidor ao criar a conta ou
 * trocar a senha — o cliente não "consome" mais nada por conta própria.
 */
export async function consumirTokenVerificado(verifyToken, finalidade) {
  const token = String(verifyToken || '')
  if (!token) return null
  const { rows } = await pool.query(
    `update mao_email_codigos set usado = true
     where verify_token = $1 and finalidade = $2 and not usado and token_expira_em > now()
     returning email, portal_role`,
    [token, finalidade],
  )
  return rows[0] ? { email: String(rows[0].email).toLowerCase(), portalRole: rows[0].portal_role || null } : null
}

export async function enviarCodigoEmail(payload) {
  const { acao = 'enviar', email, identificador, codigo, finalidade, portalRole } = payload || {}
  const tipo = finalidade === 'senha' ? 'senha' : finalidade === 'cadastro' ? 'cadastro' : ''
  if (!tipo) return { ok: false, status: 400, erro: 'Informe um e-mail válido.' }
  if (acao === 'enviar') return enviar({ email, identificador, finalidade: tipo, portalRole })
  if (acao === 'verificar') return verificar({ email, identificador, codigo, finalidade: tipo })
  return { ok: false, status: 400, erro: 'Ação não reconhecida.' }
}
