import { isLocalSuperUser } from './portalPermissoes'
import { isSupabaseConfigured, loadSupabaseConfig } from './supabaseConfig'

const OTP_META_KEY = 'mao-portal-otp-meta-v2'
const OTP_LOCAL_KEY = 'mao-portal-otp-v1'
const TOKEN_TTL_MS = 15 * 60 * 1000
const CODE_TTL_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

type OtpMeta = {
  finalidade: 'cadastro' | 'senha'
  email: string
  criadoEm: number
  verifyToken?: string
  tokenExpira?: number
  portalRole?: 'empresa' | 'profissional'
}

type OtpMetaStore = { records: OtpMeta[] }

type OtpLocalRecord = {
  finalidade: 'cadastro' | 'senha'
  email: string
  codigo: string
  expiraEm: number
  criadoEm: number
  usado: boolean
  verifyToken?: string
  tokenExpira?: number
  portalRole?: 'empresa' | 'profissional'
}

type OtpLocalStore = { records: OtpLocalRecord[] }

export type PortalRole = 'empresa' | 'profissional'

function loadMeta(): OtpMetaStore {
  try {
    const raw = localStorage.getItem(OTP_META_KEY)
    if (!raw) return { records: [] }
    return JSON.parse(raw) as OtpMetaStore
  } catch {
    return { records: [] }
  }
}

function saveMeta(store: OtpMetaStore) {
  localStorage.setItem(OTP_META_KEY, JSON.stringify(store))
}

function loadLocal(): OtpLocalStore {
  try {
    const raw = localStorage.getItem(OTP_LOCAL_KEY)
    if (!raw) return { records: [] }
    return JSON.parse(raw) as OtpLocalStore
  } catch {
    return { records: [] }
  }
}

function saveLocal(store: OtpLocalStore) {
  localStorage.setItem(OTP_LOCAL_KEY, JSON.stringify(store))
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function genToken() {
  return `vt_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function emEsperaMeta(store: OtpMetaStore, finalidade: OtpMeta['finalidade'], email: string) {
  return store.records.some(
    (item) =>
      item.finalidade === finalidade &&
      item.email === email &&
      Date.now() - (item.criadoEm || 0) < COOLDOWN_MS,
  )
}

function emEsperaLocal(store: OtpLocalStore, finalidade: OtpLocalRecord['finalidade'], email: string) {
  return store.records.some(
    (item) =>
      item.finalidade === finalidade &&
      item.email === email &&
      !item.usado &&
      Date.now() - (item.criadoEm || 0) < COOLDOWN_MS,
  )
}

async function chamarFuncao(corpo: Record<string, unknown>): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; erro: string; status?: number }
> {
  const cfg = await loadSupabaseConfig()
  const tentativas: { url: string; headers: Record<string, string> }[] = []
  if (cfg.url && cfg.anonKey) {
    tentativas.push({
      url: `${cfg.url.replace(/\/$/, '')}/functions/v1/enviar-codigo`,
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
      },
    })
  }
  tentativas.push({
    url: '/api/portal/enviar-codigo',
    headers: { 'Content-Type': 'application/json' },
  })

  let ultimo = 'Não foi possível processar o código. Tente de novo em instantes.'
  for (const tentativa of tentativas) {
    try {
      const resposta = await fetch(tentativa.url, {
        method: 'POST',
        headers: tentativa.headers,
        body: JSON.stringify(corpo),
      })
      const texto = await resposta.text()
      let data: Record<string, unknown> | null = null
      try {
        data = JSON.parse(texto) as Record<string, unknown>
      } catch {
        data = null
      }
      if (!data) continue
      if (resposta.ok && data.ok) return { ok: true, data }
      if (typeof data.erro === 'string' && data.erro) {
        ultimo = data.erro
        if (resposta.status !== 404) return { ok: false, erro: data.erro, status: resposta.status }
      }
    } catch {
      /* tenta o próximo caminho */
    }
  }
  return { ok: false, erro: ultimo }
}

async function enviarCodigoPorEmail(email: string, codigo: string, finalidade: 'cadastro' | 'senha') {
  return chamarFuncao({ acao: 'enviar_legado', email, codigo, finalidade })
}

export async function portalCadastroEnviarCodigo(
  email: string,
  portalRole: PortalRole,
): Promise<{ ok: true; mensagem: string } | { ok: false; erro: string }> {
  const em = normalizeEmail(email)
  if (!em || !em.includes('@')) return { ok: false, erro: 'Informe um e-mail válido.' }

  const cfg = await loadSupabaseConfig()
  if (isSupabaseConfigured(cfg)) {
    const store = loadMeta()
    if (emEsperaMeta(store, 'cadastro', em)) {
      return { ok: false, erro: 'Aguarde cerca de 1 minuto para pedir outro código.' }
    }
    const enviado = await chamarFuncao({
      acao: 'enviar',
      email: em,
      finalidade: 'cadastro',
      portalRole,
    })
    if (!enviado.ok) return { ok: false, erro: enviado.erro }
    store.records = store.records.filter(
      (item) => !(item.finalidade === 'cadastro' && item.email === em),
    )
    store.records.push({
      finalidade: 'cadastro',
      email: em,
      criadoEm: Date.now(),
      portalRole,
    })
    saveMeta(store)
    return { ok: true, mensagem: 'Código enviado. Confira sua caixa de entrada.' }
  }

  // Fallback local (sem Supabase): código fica neste navegador
  const store = loadLocal()
  if (emEsperaLocal(store, 'cadastro', em)) {
    return { ok: false, erro: 'Aguarde cerca de 1 minuto para pedir outro código.' }
  }
  const codigo = genCode()
  const enviado = await enviarCodigoPorEmail(em, codigo, 'cadastro')
  store.records = store.records.filter(
    (item) => !(item.finalidade === 'cadastro' && item.email === em && !item.usado),
  )
  store.records.push({
    finalidade: 'cadastro',
    email: em,
    codigo,
    expiraEm: Date.now() + CODE_TTL_MS,
    criadoEm: Date.now(),
    usado: false,
    portalRole,
  })
  saveLocal(store)
  if (!enviado.ok) {
    return {
      ok: true,
      mensagem: `Modo local: use o código ${codigo} (e-mail indisponível neste ambiente).`,
    }
  }
  return { ok: true, mensagem: 'Código enviado. Confira sua caixa de entrada.' }
}

export async function portalCadastroVerificarCodigo(
  email: string,
  codigo: string,
): Promise<{ ok: true; verify_token: string; mensagem: string } | { ok: false; erro: string }> {
  const em = normalizeEmail(email)
  const cfg = await loadSupabaseConfig()

  if (isSupabaseConfigured(cfg)) {
    const verificado = await chamarFuncao({
      acao: 'verificar',
      email: em,
      codigo: codigo.trim(),
      finalidade: 'cadastro',
    })
    if (!verificado.ok) return { ok: false, erro: verificado.erro }
    const token = String(verificado.data.verify_token || '')
    if (!token) return { ok: false, erro: 'Código inválido ou expirado.' }

    const store = loadMeta()
    const rec = store.records.find((r) => r.finalidade === 'cadastro' && r.email === em)
    if (rec) {
      rec.verifyToken = token
      rec.tokenExpira = Date.now() + TOKEN_TTL_MS
      if (typeof verificado.data.portalRole === 'string') {
        rec.portalRole = verificado.data.portalRole as PortalRole
      }
    } else {
      store.records.push({
        finalidade: 'cadastro',
        email: em,
        criadoEm: Date.now(),
        verifyToken: token,
        tokenExpira: Date.now() + TOKEN_TTL_MS,
        portalRole: (verificado.data.portalRole as PortalRole) || undefined,
      })
    }
    saveMeta(store)
    return { ok: true, verify_token: token, mensagem: 'E-mail confirmado. Defina usuário e senha.' }
  }

  const store = loadLocal()
  const rec = store.records.find(
    (r) =>
      r.finalidade === 'cadastro' &&
      r.email === em &&
      !r.usado &&
      r.codigo === codigo.trim() &&
      r.expiraEm > Date.now(),
  )
  if (!rec) return { ok: false, erro: 'Código inválido ou expirado.' }
  const token = genToken()
  rec.verifyToken = token
  rec.tokenExpira = Date.now() + TOKEN_TTL_MS
  saveLocal(store)
  return { ok: true, verify_token: token, mensagem: 'E-mail confirmado. Defina usuário e senha.' }
}

export function portalPeekCadastroToken(verifyToken: string): {
  email: string
  portalRole: PortalRole
} | null {
  const meta = loadMeta().records.find(
    (r) =>
      r.finalidade === 'cadastro' &&
      r.verifyToken === verifyToken &&
      (r.tokenExpira ?? 0) > Date.now(),
  )
  if (meta?.portalRole) return { email: meta.email, portalRole: meta.portalRole }

  const local = loadLocal().records.find(
    (r) =>
      r.finalidade === 'cadastro' &&
      r.verifyToken === verifyToken &&
      (r.tokenExpira ?? 0) > Date.now() &&
      !r.usado,
  )
  if (!local?.portalRole) return null
  return { email: local.email, portalRole: local.portalRole }
}

export async function portalConsumeCadastroToken(verifyToken: string): Promise<boolean> {
  const cfg = await loadSupabaseConfig()
  if (isSupabaseConfigured(cfg)) {
    const consumido = await chamarFuncao({
      acao: 'consumir',
      verify_token: verifyToken,
      finalidade: 'cadastro',
    })
    if (!consumido.ok) return false
    const store = loadMeta()
    store.records = store.records.filter((r) => r.verifyToken !== verifyToken)
    saveMeta(store)
    return true
  }

  const store = loadLocal()
  const rec = store.records.find((r) => r.verifyToken === verifyToken)
  if (!rec || (rec.tokenExpira ?? 0) <= Date.now()) return false
  rec.usado = true
  saveLocal(store)
  return true
}

export async function portalSenhaEnviarCodigo(
  identificador: string,
  resolveEmail: (id: string) => string | null | Promise<string | null>,
): Promise<{ ok: true; mensagem: string; email: string } | { ok: false; erro: string }> {
  const email = await resolveEmail(identificador.trim())
  if (!email) return { ok: false, erro: 'Usuário ou e-mail não encontrado.' }
  const em = normalizeEmail(email)
  const cfg = await loadSupabaseConfig()

  if (isSupabaseConfigured(cfg)) {
    const store = loadMeta()
    if (emEsperaMeta(store, 'senha', em)) {
      return { ok: false, erro: 'Aguarde cerca de 1 minuto para pedir outro código.' }
    }
    const enviado = await chamarFuncao({ acao: 'enviar', email: em, finalidade: 'senha' })
    if (!enviado.ok) return { ok: false, erro: enviado.erro }
    store.records = store.records.filter((item) => !(item.finalidade === 'senha' && item.email === em))
    store.records.push({ finalidade: 'senha', email: em, criadoEm: Date.now() })
    saveMeta(store)
    return { ok: true, email: em, mensagem: 'Código enviado. Confira sua caixa de entrada.' }
  }

  const store = loadLocal()
  if (emEsperaLocal(store, 'senha', em)) {
    return { ok: false, erro: 'Aguarde cerca de 1 minuto para pedir outro código.' }
  }
  const codigo = genCode()
  const enviado = await enviarCodigoPorEmail(em, codigo, 'senha')
  store.records = store.records.filter(
    (item) => !(item.finalidade === 'senha' && item.email === em && !item.usado),
  )
  store.records.push({
    finalidade: 'senha',
    email: em,
    codigo,
    expiraEm: Date.now() + CODE_TTL_MS,
    criadoEm: Date.now(),
    usado: false,
  })
  saveLocal(store)
  if (!enviado.ok) {
    return {
      ok: true,
      email: em,
      mensagem: `Modo local: use o código ${codigo} (e-mail indisponível neste ambiente).`,
    }
  }
  return { ok: true, email: em, mensagem: 'Código enviado. Confira sua caixa de entrada.' }
}

export async function portalSenhaVerificarCodigo(
  email: string,
  codigo: string,
): Promise<{ ok: true; verify_token: string; mensagem: string } | { ok: false; erro: string }> {
  const em = normalizeEmail(email)
  const cfg = await loadSupabaseConfig()

  if (isSupabaseConfigured(cfg)) {
    const verificado = await chamarFuncao({
      acao: 'verificar',
      email: em,
      codigo: codigo.trim(),
      finalidade: 'senha',
    })
    if (!verificado.ok) return { ok: false, erro: verificado.erro }
    const token = String(verificado.data.verify_token || '')
    if (!token) return { ok: false, erro: 'Código inválido ou expirado.' }
    const store = loadMeta()
    const rec = store.records.find((r) => r.finalidade === 'senha' && r.email === em)
    if (rec) {
      rec.verifyToken = token
      rec.tokenExpira = Date.now() + TOKEN_TTL_MS
    } else {
      store.records.push({
        finalidade: 'senha',
        email: em,
        criadoEm: Date.now(),
        verifyToken: token,
        tokenExpira: Date.now() + TOKEN_TTL_MS,
      })
    }
    saveMeta(store)
    return { ok: true, verify_token: token, mensagem: 'Código confirmado. Defina a nova senha.' }
  }

  const store = loadLocal()
  const rec = store.records.find(
    (r) =>
      r.finalidade === 'senha' &&
      r.email === em &&
      !r.usado &&
      r.codigo === codigo.trim() &&
      r.expiraEm > Date.now(),
  )
  if (!rec) return { ok: false, erro: 'Código inválido ou expirado.' }
  const token = genToken()
  rec.verifyToken = token
  rec.tokenExpira = Date.now() + TOKEN_TTL_MS
  saveLocal(store)
  return { ok: true, verify_token: token, mensagem: 'Código confirmado. Defina a nova senha.' }
}

export function portalPeekSenhaToken(verifyToken: string): string | null {
  const meta = loadMeta().records.find(
    (r) =>
      r.finalidade === 'senha' &&
      r.verifyToken === verifyToken &&
      (r.tokenExpira ?? 0) > Date.now(),
  )
  if (meta) return meta.email
  const local = loadLocal().records.find(
    (r) =>
      r.finalidade === 'senha' &&
      r.verifyToken === verifyToken &&
      (r.tokenExpira ?? 0) > Date.now() &&
      !r.usado,
  )
  return local?.email ?? null
}

export async function portalConsumeSenhaToken(verifyToken: string): Promise<boolean> {
  const cfg = await loadSupabaseConfig()
  if (isSupabaseConfigured(cfg)) {
    const consumido = await chamarFuncao({
      acao: 'consumir',
      verify_token: verifyToken,
      finalidade: 'senha',
    })
    if (!consumido.ok) return false
    const store = loadMeta()
    store.records = store.records.filter((r) => r.verifyToken !== verifyToken)
    saveMeta(store)
    return true
  }
  const store = loadLocal()
  const rec = store.records.find((r) => r.verifyToken === verifyToken)
  if (!rec || (rec.tokenExpira ?? 0) <= Date.now()) return false
  rec.usado = true
  saveLocal(store)
  return true
}

export { isLocalSuperUser }
