const OTP_MINUTOS = 10
const CODE_TTL_MS = OTP_MINUTOS * 60 * 1000
const TOKEN_TTL_MS = 15 * 60 * 1000
const COOLDOWN_MS = 60 * 1000
const PEPPER = 'doca-mao-otp'

/** @type {Map<string, any>} */
const memoria = new Map()

function ambiente(env) {
  return env ?? process.env
}

function chave(finalidade, email) {
  return `${finalidade}:${String(email || '').trim().toLowerCase()}`
}

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

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function genToken() {
  return `vt_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

async function sha256Hex(texto) {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(texto).digest('hex')
}

async function enviarResend({ email, codigo, finalidade, env }) {
  const destino = String(email || '').trim().toLowerCase()
  const digitos = String(codigo || '').replace(/\D/g, '')
  const tipo = finalidade === 'senha' ? 'senha' : finalidade === 'cadastro' ? 'cadastro' : ''
  if (!destino || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
    return { ok: false, status: 400, erro: 'Informe um e-mail válido.' }
  }
  if (digitos.length !== 6 || tipo === '') {
    return { ok: false, status: 400, erro: 'Não foi possível enviar o e-mail.' }
  }

  const config = ambiente(env)
  const apiKey = String(config.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. O envio ainda não está configurado neste ambiente.',
    }
  }

  const from =
    String(config.RESEND_FROM || '').trim() ||
    String(config.SMTP_FROM || '').trim() ||
    'Doca Livre fazumfreela <onboarding@resend.dev>'
  const { assunto, texto, html } = montarEmailCodigo(tipo, digitos)

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [destino],
        subject: assunto,
        text: texto,
        html,
      }),
    })
    if (resposta.status === 200 || resposta.status === 201) return { ok: true, status: 200 }
    return {
      ok: false,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. Tente de novo em instantes.',
    }
  } catch {
    return {
      ok: false,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. Tente de novo em instantes.',
    }
  }
}

/** Compatível com o fluxo antigo (cliente manda o código) e com acao enviar/verificar/consumir. */
export async function enviarCodigoEmail(payload) {
  const {
    email,
    codigo,
    finalidade,
    env,
    acao = codigo ? 'enviar_legado' : 'enviar',
    portalRole = null,
    verify_token = null,
  } = payload || {}

  const destino = String(email || '').trim().toLowerCase()
  const tipo = finalidade === 'senha' ? 'senha' : finalidade === 'cadastro' ? 'cadastro' : ''

  if (acao === 'enviar' || acao === 'enviar_legado') {
    if (!destino || !tipo) {
      return { ok: false, status: 400, erro: 'Informe um e-mail válido.' }
    }
    const k = chave(tipo, destino)
    const atual = memoria.get(k)
    if (atual && Date.now() - (atual.criadoEm || 0) < COOLDOWN_MS && !atual.usado) {
      return { ok: false, status: 429, erro: 'Aguarde cerca de 1 minuto para pedir outro código.' }
    }
    let digitos = String(codigo || '').replace(/\D/g, '')
    if (digitos.length !== 6) digitos = genCode()
    const hash = await sha256Hex(`${PEPPER}:${digitos}`)
    memoria.set(k, {
      finalidade: tipo,
      email: destino,
      codigoHash: hash,
      codigoPlano: digitos,
      expiraEm: Date.now() + CODE_TTL_MS,
      criadoEm: Date.now(),
      usado: false,
      portalRole: tipo === 'cadastro' ? portalRole : null,
      verifyToken: null,
      tokenExpira: null,
    })
    const enviado = await enviarResend({ email: destino, codigo: digitos, finalidade: tipo, env })
    return enviado
  }

  if (acao === 'verificar') {
    const digitos = String(codigo || '').replace(/\D/g, '')
    if (!destino || digitos.length !== 6 || !tipo) {
      return { ok: false, status: 400, erro: 'Código inválido ou expirado.' }
    }
    const rec = memoria.get(chave(tipo, destino))
    const hash = await sha256Hex(`${PEPPER}:${digitos}`)
    if (!rec || rec.usado || rec.expiraEm <= Date.now() || rec.codigoHash !== hash) {
      return { ok: false, status: 400, erro: 'Código inválido ou expirado.' }
    }
    const token = genToken()
    rec.verifyToken = token
    rec.tokenExpira = Date.now() + TOKEN_TTL_MS
    memoria.set(chave(tipo, destino), rec)
    return {
      ok: true,
      status: 200,
      verify_token: token,
      portalRole: rec.portalRole || null,
      email: destino,
    }
  }

  if (acao === 'consumir') {
    const token = String(verify_token || '')
    if (!token) return { ok: false, status: 400, erro: 'Sessão de cadastro expirada.' }
    for (const [k, rec] of memoria.entries()) {
      if (rec.verifyToken === token) {
        if (rec.usado || !rec.tokenExpira || rec.tokenExpira <= Date.now()) {
          return { ok: false, status: 400, erro: 'Sessão de cadastro expirada.' }
        }
        rec.usado = true
        memoria.set(k, rec)
        return { ok: true, status: 200 }
      }
    }
    return { ok: false, status: 400, erro: 'Sessão de cadastro expirada.' }
  }

  return { ok: false, status: 400, erro: 'Ação não reconhecida.' }
}
