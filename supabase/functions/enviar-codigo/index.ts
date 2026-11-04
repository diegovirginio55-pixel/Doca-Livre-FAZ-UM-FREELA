import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CODE_TTL_MS = 10 * 60 * 1000
const TOKEN_TTL_MS = 15 * 60 * 1000
const COOLDOWN_MS = 60 * 1000
const PEPPER = 'doca-mao-otp'

function json(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function montarEmail(finalidade: string, codigo: string) {
  const acao =
    finalidade === 'cadastro'
      ? 'confirmar seu e-mail e concluir o cadastro'
      : 'redefinir sua senha no portal'
  const assunto =
    finalidade === 'cadastro'
      ? 'Doca Livre fazumfreela - código de confirmação de e-mail'
      : 'Doca Livre fazumfreela - código para trocar a senha'
  const texto =
    `Seu código Doca Livre fazumfreela é: ${codigo}\n\n` +
    `Use este código para ${acao}.\n` +
    'Ele vale por 10 minutos.\n\n' +
    'Se você não solicitou, ignore este e-mail.'
  const html =
    '<p>Seu código Doca Livre fazumfreela é:</p>' +
    `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${codigo}</p>` +
    `<p>Use este código para ${acao}. Vale por 10 minutos.</p>` +
    '<p style="color:#64748b;font-size:13px">Se você não solicitou, ignore este e-mail.</p>'
  return { assunto, texto, html }
}

async function sha256Hex(texto: string) {
  const data = new TextEncoder().encode(texto)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function genToken() {
  return `vt_${crypto.randomUUID().replace(/-/g, '')}`
}

function sbAdmin() {
  const url = Deno.env.get('SUPABASE_URL')?.trim() || ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function enviarResend(email: string, finalidade: string, codigo: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim() ?? ''
  if (!apiKey) {
    return {
      ok: false as const,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. O envio ainda não está configurado neste ambiente.',
    }
  }
  const from =
    Deno.env.get('RESEND_FROM')?.trim() ||
    Deno.env.get('SMTP_FROM')?.trim() ||
    'Doca Livre fazumfreela <onboarding@resend.dev>'
  const { assunto, texto, html } = montarEmail(finalidade, codigo)
  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: assunto,
        text: texto,
        html,
      }),
    })
    if (resposta.status === 200 || resposta.status === 201) return { ok: true as const }
    if (resposta.status === 401 || resposta.status === 403 || resposta.status === 422) {
      return {
        ok: false as const,
        status: 503,
        erro: 'Não foi possível enviar o e-mail. O remetente ainda não está liberado para este endereço.',
      }
    }
    return {
      ok: false as const,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. Tente de novo em instantes.',
    }
  } catch {
    return {
      ok: false as const,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. Tente de novo em instantes.',
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { ok: false, erro: 'Não foi possível processar a solicitação.' })

  let data: Record<string, unknown>
  try {
    data = await req.json()
  } catch {
    return json(400, { ok: false, erro: 'Não foi possível processar a solicitação.' })
  }

  const acao = String(data.acao || (data.codigo ? 'enviar_legado' : 'enviar'))
  const destino = String(data.email || '').trim().toLowerCase()
  const tipo = data.finalidade === 'senha' ? 'senha' : data.finalidade === 'cadastro' ? 'cadastro' : ''
  const portalRole =
    data.portalRole === 'empresa' || data.portalRole === 'profissional' ? data.portalRole : null

  const admin = sbAdmin()
  if (!admin) {
    return json(503, {
      ok: false,
      erro: 'Não foi possível processar o código. Serviço de banco indisponivel.',
    })
  }

  if (acao === 'enviar' || acao === 'enviar_legado') {
    if (!destino || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino) || !tipo) {
      return json(400, { ok: false, erro: 'Informe um e-mail válido.' })
    }

    const { data: recentes } = await admin
      .from('mao_email_codigos')
      .select('created_at')
      .eq('finalidade', tipo)
      .ilike('email', destino)
      .eq('usado', false)
      .order('created_at', { ascending: false })
      .limit(1)

    if (recentes?.[0]?.created_at) {
      const criado = new Date(String(recentes[0].created_at)).getTime()
      if (Date.now() - criado < COOLDOWN_MS) {
        return json(429, { ok: false, erro: 'Aguarde cerca de 1 minuto para pedir outro código.' })
      }
    }

    // Codigo gerado no servidor (ou legado se o cliente ainda enviar)
    let digitos = String(data.codigo || '').replace(/\D/g, '')
    if (digitos.length !== 6) digitos = genCode()

    const codigoHash = await sha256Hex(`${PEPPER}:${digitos}`)
    const expira = new Date(Date.now() + CODE_TTL_MS).toISOString()

    await admin
      .from('mao_email_codigos')
      .update({ usado: true })
      .eq('finalidade', tipo)
      .ilike('email', destino)
      .eq('usado', false)

    const { error: insertError } = await admin.from('mao_email_codigos').insert({
      finalidade: tipo,
      email: destino,
      codigo_hash: codigoHash,
      expira_em: expira,
      usado: false,
      portal_role: tipo === 'cadastro' ? portalRole : null,
    })
    if (insertError) {
      return json(503, { ok: false, erro: 'Não foi possível gerar o código. Tente de novo.' })
    }

    const enviado = await enviarResend(destino, tipo, digitos)
    if (!enviado.ok) return json(enviado.status, { ok: false, erro: enviado.erro })
    return json(200, { ok: true })
  }

  if (acao === 'verificar') {
    const digitos = String(data.codigo || '').replace(/\D/g, '')
    if (!destino || digitos.length !== 6 || !tipo) {
      return json(400, { ok: false, erro: 'Código inválido ou expirado.' })
    }
    const codigoHash = await sha256Hex(`${PEPPER}:${digitos}`)
    const { data: rows, error } = await admin
      .from('mao_email_codigos')
      .select('*')
      .eq('finalidade', tipo)
      .ilike('email', destino)
      .eq('usado', false)
      .eq('codigo_hash', codigoHash)
      .gt('expira_em', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !rows?.length) {
      return json(400, { ok: false, erro: 'Código inválido ou expirado.' })
    }

    const token = genToken()
    const tokenExpira = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
    const { error: updError } = await admin
      .from('mao_email_codigos')
      .update({ verify_token: token, token_expira_em: tokenExpira })
      .eq('id', rows[0].id)

    if (updError) {
      return json(503, { ok: false, erro: 'Não foi possível confirmar o código.' })
    }

    return json(200, {
      ok: true,
      verify_token: token,
      portalRole: rows[0].portal_role || null,
      email: destino,
    })
  }

  if (acao === 'consumir') {
    const token = String(data.verify_token || '')
    if (!token) return json(400, { ok: false, erro: 'Sessão de cadastro expirada.' })
    const { data: rows, error } = await admin
      .from('mao_email_codigos')
      .select('id, token_expira_em, usado')
      .eq('verify_token', token)
      .limit(1)

    if (error || !rows?.length) {
      return json(400, { ok: false, erro: 'Sessão de cadastro expirada.' })
    }
    const row = rows[0]
    if (row.usado || !row.token_expira_em || new Date(String(row.token_expira_em)).getTime() <= Date.now()) {
      return json(400, { ok: false, erro: 'Sessão de cadastro expirada.' })
    }
    await admin.from('mao_email_codigos').update({ usado: true }).eq('id', row.id)
    return json(200, { ok: true })
  }

  return json(400, { ok: false, erro: 'Ação não reconhecida.' })
})
