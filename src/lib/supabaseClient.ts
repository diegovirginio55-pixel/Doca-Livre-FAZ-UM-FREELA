import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { emDemo } from './modo'
import { tokenAtual } from './sessao'
import { isSupabaseConfigured, loadSupabaseConfig } from './supabaseConfig'

let client: SupabaseClient | null = null
let initPromise: Promise<SupabaseClient | null> | null = null

/** Cliente do banco. No modo demo não existe: nada sai deste navegador. */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (emDemo()) return null
  if (client) return client
  if (initPromise) return initPromise
  initPromise = (async () => {
    const cfg = await loadSupabaseConfig()
    if (!isSupabaseConfigured(cfg)) return null
    client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Cada pedido leva o token da sessão; o banco aplica as regras de acesso por usuário.
      // Sem sessão vai a chave pública, que não lê nada.
      accessToken: async () => tokenAtual() ?? cfg.anonKey,
    })
    return client
  })()
  return initPromise
}

export function supabaseReadySync() {
  return client != null
}
