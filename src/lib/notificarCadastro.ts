import { loadSupabaseConfig } from './supabaseConfig'

export type NotificacaoCadastroInput = {
  email: string
  nome: string
  tipo: 'profissional' | 'empresa'
  decisao: 'aprovado' | 'recusado'
  motivo?: string
}

export async function notificarDecisaoCadastro(
  input: NotificacaoCadastroInput,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const email = String(input.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { ok: false, erro: 'E-mail do cadastro não encontrado.' }
  }

  const corpo = {
    email,
    nome: String(input.nome || '').trim(),
    tipo: input.tipo,
    decisao: input.decisao,
    motivo: String(input.motivo || '').trim(),
  }

  const cfg = await loadSupabaseConfig()
  const tentativas: { url: string; headers: Record<string, string> }[] = []
  if (cfg.url && cfg.anonKey) {
    tentativas.push({
      url: `${cfg.url.replace(/\/$/, '')}/functions/v1/notificar-cadastro`,
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
      },
    })
  }
  tentativas.push({
    url: '/api/portal/notificar-cadastro',
    headers: { 'Content-Type': 'application/json' },
  })

  let ultimo = 'Não foi possível enviar o e-mail. Tente de novo em instantes.'
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
      if (resposta.ok && data.ok) return { ok: true }
      if (typeof data.erro === 'string' && data.erro) {
        ultimo = data.erro
        if (resposta.status !== 404) return { ok: false, erro: data.erro }
      }
    } catch {
      /* tenta o próximo caminho */
    }
  }
  return { ok: false, erro: ultimo }
}