/** Token de sessão emitido pela API no login (o banco usa para saber quem está pedindo). */
export type Sessao = {
  token: string
  /** Segundos desde 1970 (claim exp do token). */
  expira: number
  contaId: string
  /** Senha provisória: o token só serve para trocar a senha. */
  trocarSenha?: boolean
}

const CHAVE_SESSAO = 'mao-sessao-v1'

export function lerSessao(): Sessao | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO)
    if (!bruto) return null
    const s = JSON.parse(bruto) as Sessao
    if (!s?.token || !s.contaId || !Number.isFinite(s.expira) || s.expira * 1000 <= Date.now()) {
      localStorage.removeItem(CHAVE_SESSAO)
      return null
    }
    return s
  } catch {
    return null
  }
}

export function salvarSessao(sessao: Sessao) {
  try {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
  } catch {
    /* sem storage: a sessão vale só até recarregar */
  }
  memoria = sessao
}

export function limparSessao() {
  memoria = null
  try {
    localStorage.removeItem(CHAVE_SESSAO)
  } catch {
    /* ignore */
  }
}

let memoria: Sessao | null = null

/** Token válido para dados (não o provisório de troca de senha). */
export function tokenAtual(): string | null {
  const s = lerSessao() ?? (memoria && memoria.expira * 1000 > Date.now() ? memoria : null)
  if (!s || s.trocarSenha) return null
  return s.token
}

/** Token mesmo que provisório (para a chamada de troca de senha). */
export function tokenQualquer(): string | null {
  const s = lerSessao() ?? (memoria && memoria.expira * 1000 > Date.now() ? memoria : null)
  return s?.token ?? null
}
