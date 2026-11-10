import { enviarEmail } from '../email.mjs'

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function montarEmailNotificacaoCadastro({ nome, tipo, decisao, motivo }) {
  const quem = tipo === 'empresa' ? 'da empresa' : 'de colaborador'
  const rotulo = String(nome || '').trim() || 'olá'
  const rotuloHtml = escaparHtml(rotulo)
  if (decisao === 'aprovado' || decisao === 'aprovada') {
    const assunto = 'Doca Livre fazumfreela — cadastro aprovado'
    const texto =
      `Olá, ${rotulo}!\n\n` +
      `Seu cadastro ${quem} no Doca Livre fazumfreela foi aprovado.\n` +
      'Agora você já pode entrar e acessar o portal em https://fazumfreela.com.br\n\n' +
      'Se não foi você quem se cadastrou, ignore este e-mail.'
    const html =
      `<p>Olá, <strong>${rotuloHtml}</strong>!</p>` +
      `<p>Seu cadastro ${quem} no <strong>Doca Livre fazumfreela</strong> foi <strong>aprovado</strong>.</p>` +
      '<p>Agora você já pode entrar e acessar o portal em ' +
      '<a href="https://fazumfreela.com.br">fazumfreela.com.br</a>.</p>' +
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

  const { assunto, texto, html } = montarEmailNotificacaoCadastro({
    nome,
    tipo: papel,
    decisao: resultado,
    motivo,
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
