// Envio de e-mail pelo Azure Communication Services (ACS).
//
// No Azure o container se autentica com a própria identidade gerenciada, sem chave guardada:
// bastam ACS_ENDPOINT e EMAIL_FROM. Fora do Azure (testes, máquina local) dá para usar
// ACS_CONNECTION_STRING ("endpoint=https://...;accesskey=..."), assinando cada pedido com a chave.
// O nome que aparece no "De:" é o do remetente cadastrado no domínio do ACS, não vai no pedido.
import { createHash, createHmac } from 'node:crypto'

const API_VERSION = '2023-03-31'
const RECURSO = 'https://communication.azure.com'
let tokenGuardado = null

function configuracao() {
  const conexao = String(process.env.ACS_CONNECTION_STRING || '').trim()
  const partes = {}
  for (const parte of conexao.split(';')) {
    const i = parte.indexOf('=')
    if (i > 0) partes[parte.slice(0, i).trim().toLowerCase()] = parte.slice(i + 1).trim()
  }
  return {
    endpoint: String(process.env.ACS_ENDPOINT || partes.endpoint || '').trim().replace(/\/+$/, ''),
    remetente: String(process.env.EMAIL_FROM || '').trim(),
    chave: partes.accesskey || '',
  }
}

async function tokenDaIdentidade() {
  if (tokenGuardado && tokenGuardado.expira - 5 * 60_000 > Date.now()) return tokenGuardado.valor
  const endereco = process.env.IDENTITY_ENDPOINT
  const cabecalho = process.env.IDENTITY_HEADER
  if (!endereco || !cabecalho) throw new Error('sem identidade gerenciada e sem ACS_CONNECTION_STRING')
  const resposta = await fetch(`${endereco}?api-version=2019-08-01&resource=${encodeURIComponent(RECURSO)}`, {
    headers: { 'X-IDENTITY-HEADER': cabecalho },
    signal: AbortSignal.timeout(10_000),
  })
  if (!resposta.ok) {
    throw new Error(`identidade gerenciada respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`)
  }
  const dados = await resposta.json()
  tokenGuardado = { valor: dados.access_token, expira: Number(dados.expires_on) * 1000 }
  return tokenGuardado.valor
}

/** Cabeçalhos HMAC-SHA256 que o ACS exige quando o pedido usa a chave de acesso. */
export function assinarPedido(url, corpo, chave, data = new Date().toUTCString()) {
  const u = new URL(url)
  const hashCorpo = createHash('sha256').update(corpo).digest('base64')
  const texto = `POST\n${u.pathname}${u.search}\n${data};${u.host};${hashCorpo}`
  const assinatura = createHmac('sha256', Buffer.from(chave, 'base64')).update(texto).digest('base64')
  return {
    'x-ms-date': data,
    'x-ms-content-sha256': hashCorpo,
    Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${assinatura}`,
  }
}

/**
 * Envia um e-mail. Devolve { ok: true }, { ok: false, naoConfigurado: true } ou { ok: false }.
 * O motivo da falha vai só para o log do servidor, com o rótulo informado.
 */
export async function enviarEmail({ para, assunto, texto, html, rotulo = 'e-mail' }) {
  const { endpoint, remetente, chave } = configuracao()
  if (!endpoint || !remetente) return { ok: false, naoConfigurado: true }
  const url = `${endpoint}/emails:send?api-version=${API_VERSION}`
  const corpo = JSON.stringify({
    senderAddress: remetente,
    recipients: { to: [{ address: para }] },
    content: { subject: assunto, plainText: texto, html },
  })
  try {
    const autenticacao = chave ? assinarPedido(url, corpo, chave) : { Authorization: `Bearer ${await tokenDaIdentidade()}` }
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...autenticacao },
      body: corpo,
      signal: AbortSignal.timeout(20_000),
    })
    if (resposta.status === 202 || resposta.status === 200) return { ok: true }
    const detalhe = await resposta.text().catch(() => '')
    console.error(`[email] Azure recusou ${rotulo} (${resposta.status}), remetente ${remetente}: ${detalhe.slice(0, 400)}`)
  } catch (erro) {
    console.error(`[email] Falha ao enviar ${rotulo} pelo Azure: ${erro?.message || erro}`)
  }
  return { ok: false }
}
