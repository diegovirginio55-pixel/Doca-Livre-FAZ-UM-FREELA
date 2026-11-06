/**
 * Código de confirmação por e-mail (cadastro e "esqueci a senha").
 *
 * Modo real: tudo no servidor (o código fica no banco, só em hash, com limite de tentativas).
 * Antes havia a ação "enviar_legado", em que o próprio navegador escolhia o código — dava para
 * confirmar qualquer e-mail e trocar a senha de qualquer conta.
 * Modo demo: o código é gerado aqui e mostrado na tela; nada sai do navegador.
 */
import { chamarApi } from './api'
import { emDemo } from './modo'
import { isLocalSuperUser } from './portalPermissoes'

const OTP_META_KEY = 'mao-portal-otp-meta-v3'
const OTP_DEMO_KEY = 'mao-portal-otp-demo-v1'
const TOKEN_TTL_MS = 15 * 60 * 1000
const CODE_TTL_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

export type PortalRole = 'empresa' | 'profissional'

/** O que este navegador lembra entre os passos (e-mail e papel ligados ao token confirmado). */
type OtpMeta = {
  finalidade: 'cadastro' | 'senha'
  email: string
  criadoEm: number
  verifyToken?: string
  tokenExpira?: number
  portalRole?: PortalRole
  /** Só no demo. */
  codigo?: string
  expiraEm?: number
}

type OtpStore = { records: OtpMeta[] }

function chave() {
  return emDemo() ? OTP_DEMO_KEY : OTP_META_KEY
}

function carregar(): OtpStore {
  try {
    const raw = localStorage.getItem(chave())
    return raw ? (JSON.parse(raw) as OtpStore) : { records: [] }
  } catch {
    return { records: [] }
  }
}

function gravar(store: OtpStore) {
  try {
    localStorage.setItem(chave(), JSON.stringify({ records: store.records.slice(-20) }))
  } catch {
    /* ignore */
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function aleatorio(n: number) {
  const bytes = new Uint32Array(n)
  crypto.getRandomValues(bytes)
  return bytes
}

function codigoDemo() {
  return String(100000 + (aleatorio(1)[0] % 900000))
}

function tokenDemo() {
  return `vt_${Array.from(aleatorio(4), (n) => n.toString(36)).join('')}`
}

function emEspera(store: OtpStore, finalidade: OtpMeta['finalidade'], email: string) {
  return store.records.some(
    (item) => item.finalidade === finalidade && item.email === email && Date.now() - (item.criadoEm || 0) < COOLDOWN_MS,
  )
}

function lembrar(registro: OtpMeta) {
  const store = carregar()
  store.records = store.records.filter((r) => !(r.finalidade === registro.finalidade && r.email === registro.email))
  store.records.push(registro)
  gravar(store)
}

function marcarVerificado(finalidade: OtpMeta['finalidade'], email: string, token: string, portalRole?: PortalRole) {
  const store = carregar()
  const rec = store.records.find((r) => r.finalidade === finalidade && r.email === email)
  if (rec) {
    rec.verifyToken = token
    rec.tokenExpira = Date.now() + TOKEN_TTL_MS
    if (portalRole) rec.portalRole = portalRole
  } else {
    store.records.push({ finalidade, email, criadoEm: Date.now(), verifyToken: token, tokenExpira: Date.now() + TOKEN_TTL_MS, portalRole })
  }
  gravar(store)
}

// ---------- Cadastro ----------

export async function portalCadastroEnviarCodigo(
  email: string,
  portalRole: PortalRole,
): Promise<{ ok: true; mensagem: string } | { ok: false; erro: string }> {
  const em = normalizeEmail(email)
  if (!em || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return { ok: false, erro: 'Informe um e-mail válido.' }
  if (emEspera(carregar(), 'cadastro', em)) {
    return { ok: false, erro: 'Aguarde cerca de 1 minuto para pedir outro código.' }
  }
  if (emDemo()) {
    const codigo = codigoDemo()
    lembrar({ finalidade: 'cadastro', email: em, criadoEm: Date.now(), portalRole, codigo, expiraEm: Date.now() + CODE_TTL_MS })
    return { ok: true, mensagem: `Modo demonstração: use o código ${codigo}.` }
  }
  const r = await chamarApi('/api/portal/enviar-codigo', { acao: 'enviar', email: em, finalidade: 'cadastro', portalRole })
  if (!r.ok) return { ok: false, erro: r.erro }
  lembrar({ finalidade: 'cadastro', email: em, criadoEm: Date.now(), portalRole })
  return { ok: true, mensagem: 'Código enviado. Confira sua caixa de entrada.' }
}

export async function portalCadastroVerificarCodigo(
  email: string,
  codigo: string,
): Promise<{ ok: true; verify_token: string; mensagem: string } | { ok: false; erro: string }> {
  const em = normalizeEmail(email)
  const mensagem = 'E-mail confirmado. Defina usuário e senha.'
  if (emDemo()) {
    const rec = carregar().records.find(
      (r) => r.finalidade === 'cadastro' && r.email === em && r.codigo === codigo.trim() && (r.expiraEm ?? 0) > Date.now(),
    )
    if (!rec) return { ok: false, erro: 'Código inválido ou expirado.' }
    const token = tokenDemo()
    marcarVerificado('cadastro', em, token)
    return { ok: true, verify_token: token, mensagem }
  }
  const r = await chamarApi<{ verify_token: string; portalRole?: PortalRole }>('/api/portal/enviar-codigo', {
    acao: 'verificar',
    email: em,
    codigo: codigo.trim(),
    finalidade: 'cadastro',
  })
  if (!r.ok) return { ok: false, erro: r.erro }
  if (!r.verify_token) return { ok: false, erro: 'Código inválido ou expirado.' }
  marcarVerificado('cadastro', em, r.verify_token, r.portalRole)
  return { ok: true, verify_token: r.verify_token, mensagem }
}

export function portalPeekCadastroToken(verifyToken: string): { email: string; portalRole: PortalRole } | null {
  const rec = carregar().records.find(
    (r) => r.finalidade === 'cadastro' && r.verifyToken === verifyToken && (r.tokenExpira ?? 0) > Date.now(),
  )
  return rec?.portalRole ? { email: rec.email, portalRole: rec.portalRole } : null
}

/** O servidor gasta o token ao criar a conta; aqui só esquecemos o registro local. */
export async function portalConsumeCadastroToken(verifyToken: string): Promise<boolean> {
  const store = carregar()
  store.records = store.records.filter((r) => r.verifyToken !== verifyToken)
  gravar(store)
  return true
}

// ---------- Esqueci a senha ----------

export async function portalSenhaEnviarCodigo(
  identificador: string,
  resolveEmail: (id: string) => string | null | Promise<string | null>,
): Promise<{ ok: true; mensagem: string; email: string } | { ok: false; erro: string }> {
  const id = identificador.trim()
  if (!id) return { ok: false, erro: 'Informe usuário ou e-mail.' }
  if (emDemo()) {
    const email = await resolveEmail(id)
    if (!email) return { ok: false, erro: 'Usuário ou e-mail não encontrado.' }
    const em = normalizeEmail(email)
    if (emEspera(carregar(), 'senha', em)) return { ok: false, erro: 'Aguarde cerca de 1 minuto para pedir outro código.' }
    const codigo = codigoDemo()
    lembrar({ finalidade: 'senha', email: em, criadoEm: Date.now(), codigo, expiraEm: Date.now() + CODE_TTL_MS })
    return { ok: true, email: em, mensagem: `Modo demonstração: use o código ${codigo}.` }
  }
  // O servidor descobre o e-mail da conta pelo usuário (a lista de contas não fica mais no navegador).
  const r = await chamarApi<{ email: string }>('/api/portal/enviar-codigo', {
    acao: 'enviar',
    identificador: id,
    finalidade: 'senha',
  })
  if (!r.ok) return { ok: false, erro: r.erro }
  const em = normalizeEmail(r.email || '')
  lembrar({ finalidade: 'senha', email: em, criadoEm: Date.now() })
  return { ok: true, email: em, mensagem: 'Código enviado. Confira sua caixa de entrada.' }
}

export async function portalSenhaVerificarCodigo(
  email: string,
  codigo: string,
): Promise<{ ok: true; verify_token: string; mensagem: string } | { ok: false; erro: string }> {
  const em = normalizeEmail(email)
  const mensagem = 'Código confirmado. Defina a nova senha.'
  if (emDemo()) {
    const rec = carregar().records.find(
      (r) => r.finalidade === 'senha' && r.email === em && r.codigo === codigo.trim() && (r.expiraEm ?? 0) > Date.now(),
    )
    if (!rec) return { ok: false, erro: 'Código inválido ou expirado.' }
    const token = tokenDemo()
    marcarVerificado('senha', em, token)
    return { ok: true, verify_token: token, mensagem }
  }
  const r = await chamarApi<{ verify_token: string }>('/api/portal/enviar-codigo', {
    acao: 'verificar',
    email: em,
    codigo: codigo.trim(),
    finalidade: 'senha',
  })
  if (!r.ok) return { ok: false, erro: r.erro }
  if (!r.verify_token) return { ok: false, erro: 'Código inválido ou expirado.' }
  marcarVerificado('senha', em, r.verify_token)
  return { ok: true, verify_token: r.verify_token, mensagem }
}

export function portalPeekSenhaToken(verifyToken: string): string | null {
  const rec = carregar().records.find(
    (r) => r.finalidade === 'senha' && r.verifyToken === verifyToken && (r.tokenExpira ?? 0) > Date.now(),
  )
  return rec?.email ?? null
}

export async function portalConsumeSenhaToken(verifyToken: string): Promise<boolean> {
  return portalConsumeCadastroToken(verifyToken)
}

export { isLocalSuperUser }
