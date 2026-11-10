import { loadSupabaseConfig } from './supabaseConfig'
import { tokenAtual, tokenQualquer } from './sessao'

export type RespostaApi<T> = ({ ok: true } & T) | { ok: false; erro: string; status?: number }

/**
 * Chama uma rota da API (Azure) com a chave do site e, se houver, o token da sessão.
 * Antes cada módulo montava a chamada e caía para o servidor do Render, que respondia sem
 * login nenhum (e-mails e análise de documento abertos para qualquer um).
 */
export async function chamarApi<T extends Record<string, unknown>>(
  caminho: string,
  corpo?: Record<string, unknown>,
  opts: { metodo?: 'GET' | 'POST'; tokenProvisorio?: boolean; erroPadrao?: string } = {},
): Promise<RespostaApi<T>> {
  const erroPadrao = opts.erroPadrao || 'Não foi possível falar com o servidor. Tente de novo em instantes.'
  const cfg = await loadSupabaseConfig()
  if (!cfg.url) return { ok: false, erro: erroPadrao }
  const token = opts.tokenProvisorio ? tokenQualquer() : tokenAtual()
  const headers: Record<string, string> = { apikey: cfg.anonKey }
  if (token) headers.Authorization = `Bearer ${token}`
  if (corpo) headers['Content-Type'] = 'application/json'
  try {
    const resposta = await fetch(`${cfg.url.replace(/\/$/, '')}${caminho}`, {
      method: opts.metodo || (corpo ? 'POST' : 'GET'),
      headers,
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
    let data: Record<string, unknown> | null = null
    try {
      data = (await resposta.json()) as Record<string, unknown>
    } catch {
      data = null
    }
    if (resposta.ok && data && data.ok !== false) return { ok: true, ...(data as T) }
    const erro = typeof data?.erro === 'string' && data.erro ? data.erro : erroPadrao
    return { ok: false, erro, status: resposta.status }
  } catch {
    return { ok: false, erro: erroPadrao }
  }
}
