// Senhas (scrypt) e token de sessão (JWT HS256) sem dependências externas.
// O mesmo segredo é passado ao PostgREST (start.mjs), que valida o token e expõe as
// claims às regras de acesso do banco (003_seguranca.sql).
import { createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const N = 16384
const R = 8
const P = 1
const TAMANHO = 64

export async function gerarHashSenha(senha) {
  const sal = randomBytes(16)
  const hash = await scrypt(String(senha), sal, TAMANHO, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${Buffer.from(hash).toString('base64')}`
}

export async function conferirSenha(senha, guardado) {
  const partes = String(guardado || '').split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false
  const [, n, r, p, salB64, hashB64] = partes
  const esperado = Buffer.from(hashB64, 'base64')
  const calculado = Buffer.from(
    await scrypt(String(senha), Buffer.from(salB64, 'base64'), esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    }),
  )
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado)
}

/** Regra de senha forte: 10+ caracteres, com letra maiúscula, minúscula e número. */
export function problemaSenha(senha) {
  const s = String(senha || '')
  if (s.length < 10) return 'A senha precisa ter pelo menos 10 caracteres.'
  if (s.length > 128) return 'A senha pode ter no máximo 128 caracteres.'
  if (!/[a-z]/.test(s) || !/[A-Z]/.test(s) || !/\d/.test(s)) {
    return 'Use letras maiúsculas, minúsculas e números na senha.'
  }
  if (/^(.)\1+$/.test(s) || /(012345|123456|abcdef|qwerty|senha|password)/i.test(s)) {
    return 'Essa senha é fácil de adivinhar. Escolha outra.'
  }
  return ''
}

export function segredoJwt() {
  const proprio = String(process.env.JWT_SECRET || '').trim()
  if (proprio.length >= 32) return proprio
  const base = String(process.env.PGPASSWORD || process.env.AZURE_STORAGE_KEY || '')
  if (!base) return ''
  // Derivado de um segredo que todas as réplicas já têm: o token vale em qualquer réplica.
  return createHmac('sha256', base).update('fazumfreela-jwt-v1').digest('hex')
}

function b64url(dados) {
  return Buffer.from(dados).toString('base64url')
}

export const HORAS_SESSAO = 12

/**
 * `restrito`: a conta precisa trocar a senha antes de qualquer coisa. O token só serve para a
 * troca; o banco (fz_uid) e a API ignoram esse token para dados.
 */
export function assinarToken(conta, { restrito = false } = {}) {
  const segredo = segredoJwt()
  if (!segredo) throw new Error('Segredo do token não configurado')
  const agora = Math.floor(Date.now() / 1000)
  const corpo = {
    role: 'web',
    sub: String(conta.id),
    papel: String(conta.role),
    ...(restrito ? { trocar: true } : {}),
    iat: agora,
    exp: agora + (restrito ? 1 : HORAS_SESSAO) * 3600,
  }
  const cabecalho = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const carga = b64url(JSON.stringify(corpo))
  const assinatura = createHmac('sha256', segredo).update(`${cabecalho}.${carga}`).digest('base64url')
  return { token: `${cabecalho}.${carga}.${assinatura}`, expira: corpo.exp }
}

/** Devolve as claims se o token for válido e não estiver vencido; senão null. */
export function lerToken(token) {
  const segredo = segredoJwt()
  const partes = String(token || '').split('.')
  if (!segredo || partes.length !== 3) return null
  const [cabecalho, carga, assinatura] = partes
  const certa = Buffer.from(createHmac('sha256', segredo).update(`${cabecalho}.${carga}`).digest('base64url'))
  const veio = Buffer.from(assinatura)
  if (certa.length !== veio.length || !timingSafeEqual(certa, veio)) return null
  try {
    const claims = JSON.parse(Buffer.from(carga, 'base64url').toString('utf8'))
    if (!claims.sub || !claims.exp || claims.exp < Date.now() / 1000) return null
    return claims
  } catch {
    return null
  }
}

export function tokenDoPedido(req) {
  const valor = String(req.headers.authorization || '')
  return valor.toLowerCase().startsWith('bearer ') ? valor.slice(7).trim() : ''
}

export function pareceJwt(token) {
  return String(token || '').split('.').length === 3
}

/** Código de 6 dígitos e tokens com gerador criptográfico (antes: Math.random). */
export function gerarCodigo() {
  return String(randomInt(100000, 1000000))
}

export function gerarTokenAleatorio(prefixo = 'vt') {
  return `${prefixo}_${randomBytes(24).toString('base64url')}`
}

export function senhaTemporaria() {
  // 12 caracteres com maiúscula, minúscula e número garantidos.
  const letras = 'abcdefghjkmnpqrstuvwxyz'
  const maius = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const nums = '23456789'
  const todos = letras + maius + nums
  const escolha = (lista) => lista[randomInt(0, lista.length)]
  const base = [escolha(maius), escolha(letras), escolha(nums)]
  while (base.length < 12) base.push(escolha(todos))
  for (let i = base.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1)
    ;[base[i], base[j]] = [base[j], base[i]]
  }
  return base.join('')
}
