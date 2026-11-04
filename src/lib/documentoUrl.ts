import { getSupabase } from './supabaseClient'

/** Resolve data URL local ou URL assinada do Storage para preview/download. */
export async function urlArquivoDocumento(opts: {
  arquivoDados?: string
  storagePath?: string
}): Promise<string | null> {
  if (opts.arquivoDados?.startsWith('data:')) return opts.arquivoDados
  const path = opts.storagePath?.trim()
  if (!path) return null
  const sb = await getSupabase()
  if (!sb) return null
  const { data, error } = await sb.storage.from('mao-documentos').createSignedUrl(path, 60 * 30)
  if (error || !data?.signedUrl) {
    console.warn('[documentoUrl]', error?.message)
    return null
  }
  return data.signedUrl
}