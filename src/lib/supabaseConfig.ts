export type SupabaseRuntimeConfig = {
  url: string
  anonKey: string
}

export const AZURE_API_URL =
  'https://fazumfreela-api.purpleocean-4b1d485c.brazilsouth.azurecontainerapps.io'
export const DEFAULT_ANON_KEY = 'sb_publishable_h_-Uv-VBm6GfOwG8BVFNxQ_MDnxMjpI'

let cached: SupabaseRuntimeConfig | null = null

export async function loadSupabaseConfig(): Promise<SupabaseRuntimeConfig> {
  if (cached) return cached
  let url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
  let anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

  if (!url || url.includes('supabase.co')) {
    try {
      const res = await fetch(`/supabase-config.json?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as Partial<SupabaseRuntimeConfig>
        if (json.url && !json.url.includes('supabase.co')) {
          url = json.url.trim()
        }
        if (json.anonKey) {
          anonKey = json.anonKey.trim()
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!url || url.includes('supabase.co')) {
    url = AZURE_API_URL
  }
  if (!anonKey) {
    anonKey = DEFAULT_ANON_KEY
  }

  cached = { url, anonKey }
  return cached
}

export function isSupabaseConfigured(cfg: SupabaseRuntimeConfig) {
  return Boolean(cfg.url && cfg.anonKey)
}
