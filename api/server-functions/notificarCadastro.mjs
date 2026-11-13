import { enviarEmail } from '../email.mjs'
import { pool } from '../migrar.mjs'

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Empresa cadastrada pela gestão: leva o login e a senha provisória, que acabou de ser gerada
 * (o sistema não guarda senhas legíveis; esta só existe neste momento) e vale até a primeira troca.
 */
export function montarEmailContaCriada({ nome, usuario, email, senha }) {
  const rotulo = String(nome || '').trim() || 'olá'
  const assunto = 'Doca Livre fazumfreela — acesso da sua empresa'
  const texto =
    `Olá, ${rotulo}!\n\n` +
    'Sua empresa foi cadastrada no Doca Livre fazumfreela.\n\n' +
    'Como entrar: acesse https://fazumfreela.com.br e escolha "Empresa".\n' +
    `  Usuário: ${usuario}\n` +
    `  Ou o e-mail: ${email}\n` +
    `  Senha provisória: ${senha}\n\n` +
    'No primeiro acesso o sistema pede para você criar a sua própria senha. A provisória deixa de valer na hora.\n\n' +
    'Se você não esperava este e-mail, ignore-o.'
  const html =
    `<p>Olá, <strong>${escaparHtml(rotulo)}</strong>!</p>` +
    '<p>Sua empresa foi cadastrada no <strong>Doca Livre fazumfreela</strong>.</p>' +
    '<p><strong>Como entrar:</strong> acesse <a href="https://fazumfreela.com.br">fazumfreela.com.br</a> e escolha <strong>Empresa</strong>.</p>' +
    '<table style="border-collapse:collapse;margin:8px 0 12px;font-size:15px">' +
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Usuário</td><td style="padding:4px 0"><strong>${escaparHtml(usuario)}</strong></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Ou o e-mail</td><td style="padding:4px 0">${escaparHtml(email)}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Senha provisória</td><td style="padding:4px 0;font-family:monospace;font-size:16px"><strong>${escaparHtml(senha)}</strong></td></tr>` +
    '</table>' +
    '<p>No primeiro acesso o sistema pede para você criar a sua própria senha. A provisória deixa de valer na hora.</p>' +
    '<p style="color:#64748b;font-size:13px">Se você não esperava este e-mail, ignore-o.</p>'
  return { assunto, texto, html }
}

export function montarEmailNotificacaoCadastro({ nome, tipo, decisao, motivo, usuario, email }) {
  const quem = tipo === 'empresa' ? 'da empresa' : 'de colaborador'
  const rotulo = String(nome || '').trim() || 'olá'
  const rotuloHtml = escaparHtml(rotulo)
  if (decisao === 'aprovado' || decisao === 'aprovada') {
    const assunto = 'Doca Livre fazumfreela — cadastro aprovado'
    const portal = tipo === 'empresa' ? 'Empresa' : 'Trabalhador'
    // A senha não vai no e-mail: o sistema só guarda o hash e não tem como saber qual é.
    const login = String(usuario || '').trim()
    const contato = String(email || '').trim()
    const linhasAcesso = [
      login ? `Usuário: ${login}` : '',
      contato ? `${login ? 'Ou o e-mail' : 'E-mail'}: ${contato}` : '',
      'Senha: a que você criou no cadastro',
    ].filter(Boolean)
    const texto =
      `Olá, ${rotulo}!\n\n` +
      `Seu cadastro ${quem} no Doca Livre fazumfreela foi aprovado.\n\n` +
      `Como entrar: acesse https://fazumfreela.com.br e escolha "${portal}".\n` +
      linhasAcesso.map((l) => `  ${l}\n`).join('') +
      '\nEsqueceu a senha? Na tela de login, clique em "Esqueci a senha" e use o código enviado para este e-mail.\n\n' +
      'Se não foi você quem se cadastrou, ignore este e-mail.'
    const html =
      `<p>Olá, <strong>${rotuloHtml}</strong>!</p>` +
      `<p>Seu cadastro ${quem} no <strong>Doca Livre fazumfreela</strong> foi <strong>aprovado</strong>.</p>` +
      `<p><strong>Como entrar:</strong> acesse <a href="https://fazumfreela.com.br">fazumfreela.com.br</a> e escolha <strong>${portal}</strong>.</p>` +
      '<table style="border-collapse:collapse;margin:8px 0 12px;font-size:15px">' +
      (login ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Usuário</td><td style="padding:4px 0"><strong>${escaparHtml(login)}</strong></td></tr>` : '') +
      (contato ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${login ? 'Ou o e-mail' : 'E-mail'}</td><td style="padding:4px 0">${escaparHtml(contato)}</td></tr>` : '') +
      '<tr><td style="padding:4px 12px 4px 0;color:#64748b">Senha</td><td style="padding:4px 0">a que você criou no cadastro</td></tr>' +
      '</table>' +
      '<p>Esqueceu a senha? Na tela de login, clique em <strong>Esqueci a senha</strong> e use o código enviado para este e-mail.</p>' +
      '<p style="color:#64748b;font-size:13px">Se não foi você quem se cadastrou, ignore este e-mail.</p>'
    return { assunto, texto, html }
  }
  const razao = String(motivo || '').trim() || 'Não informado.'
  const assunto = 'Doca Livre fazumfreela — cadastro não aprovado'
  const texto =
    `Olá, ${rotulo}!\n\n` +
    `Analisamos seu cadastro ${quem} no Doca Livre fazumfreela e, neste momento, ele não foi aprovado.\n\n` +
    `Motivo: ${razao}\n\n` +
    'Se quiser corrigir os dados ou documentos e tentar de novo, acesse https://fazumfreela.com.br\n\n' +
    'Se não foi você quem se cadastrou, ignore este e-mail.'
  const html =
    `<p>Olá, <strong>${rotuloHtml}</strong>!</p>` +
    `<p>Analisamos seu cadastro ${quem} no <strong>Doca Livre fazumfreela</strong> e, neste momento, ele <strong>não foi aprovado</strong>.</p>` +
    `<p><strong>Motivo:</strong> ${escaparHtml(razao)}</p>` +
    '<p>Se quiser corrigir os dados ou documentos e tentar de novo, acesse ' +
    '<a href="https://fazumfreela.com.br">fazumfreela.com.br</a>.</p>' +
    '<p style="color:#64748b;font-size:13px">Se não foi você quem se cadastrou, ignore este e-mail.</p>'
  return { assunto, texto, html }
}

export async function notificarCadastro(payload) {
  const {
    email,
    nome = '',
    tipo,
    decisao,
    motivo = '',
  } = payload || {}

  const destino = String(email || '').trim().toLowerCase()
  const papel = tipo === 'empresa' ? 'empresa' : tipo === 'profissional' ? 'profissional' : ''
  const resultado =
    decisao === 'aprovado' || decisao === 'aprovada'
      ? 'aprovado'
      : decisao === 'recusado' || decisao === 'recusada'
        ? 'recusado'
        : ''

  if (!destino || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
    return { ok: false, status: 400, erro: 'Informe um e-mail válido.' }
  }
  if (!papel || !resultado) {
    return { ok: false, status: 400, erro: 'Não foi possível montar o aviso de cadastro.' }
  }
  if (resultado === 'recusado' && !String(motivo || '').trim()) {
    return { ok: false, status: 400, erro: 'Informe o motivo da recusa.' }
  }

  // O login vem do banco (não do que a tela mandou): é o usuário da conta dona deste e-mail.
  let usuario = ''
  if (resultado === 'aprovado') {
    try {
      const { rows } = await pool.query(`select usuario from mao_contas where lower(email) = $1 limit 1`, [destino])
      usuario = rows[0]?.usuario || ''
    } catch {
      /* sem o usuário, o e-mail mostra só o e-mail de acesso */
    }
  }
  const { assunto, texto, html } = montarEmailNotificacaoCadastro({
    nome,
    tipo: papel,
    decisao: resultado,
    motivo,
    usuario,
    email: destino,
  })
  const r = await enviarEmail({ para: destino, assunto, texto, html, rotulo: 'o aviso de cadastro' })
  if (r.ok) return { ok: true, status: 200 }
  if (r.naoConfigurado) {
    return {
      ok: false,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. O envio ainda não está configurado neste ambiente.',
    }
  }
  return { ok: false, status: 503, erro: 'Não foi possível enviar o e-mail. Tente de novo em instantes.' }
}
