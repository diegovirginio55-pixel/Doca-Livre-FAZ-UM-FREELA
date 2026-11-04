const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function montarEmail(params: {
  nome: string
  tipo: 'profissional' | 'empresa'
  decisao: 'aprovado' | 'recusado'
  motivo?: string
}) {
  const quem = params.tipo === 'empresa' ? 'da empresa' : 'de colaborador'
  const nome = params.nome.trim() || 'olá'
  if (params.decisao === 'aprovado') {
    const assunto = 'Doca Livre fazumfreela — cadastro aprovado'
    const texto =
      `Olá, ${nome}!\n\n` +
      `Seu cadastro ${quem} no Doca Livre fazumfreela foi aprovado.\n` +
      'Agora você já pode entrar e acessar o portal em https://fazumfreela.com.br\n\n' +
      'Se não foi você quem se cadastrou, ignore este e-mail.'
    const html =
      `<p>Olá, <strong>${nome}</strong>!</p>` +
      `<p>Seu cadastro ${quem} no <strong>Doca Livre fazumfreela</strong> foi <strong>aprovado</strong>.</p>` +
      '<p>Agora você já pode entrar e acessar o portal em ' +
      '<a href="https://fazumfreela.com.br">fazumfreela.com.br</a>.</p>' +
      '<p style="color:#64748b;font-size:13px">Se não foi você quem se cadastrou, ignore este e-mail.</p>'
    return { assunto, texto, html }
  }
  const motivo = (params.motivo || '').trim() || 'Não informado.'
  const assunto = 'Doca Livre fazumfreela — cadastro não aprovado'
  const texto =
    `Olá, ${nome}!\n\n` +
    `Analisamos seu cadastro ${quem} no Doca Livre fazumfreela e, neste momento, ele não foi aprovado.\n\n` +
    `Motivo: ${motivo}\n\n` +
    'Se quiser corrigir os dados ou documentos e tentar de novo, acesse https://fazumfreela.com.br\n\n' +
    'Se não foi você quem se cadastrou, ignore este e-mail.'
  const html =
    `<p>Olá, <strong>${nome}</strong>!</p>` +
    `<p>Analisamos seu cadastro ${quem} no <strong>Doca Livre fazumfreela</strong> e, neste momento, ele <strong>não foi aprovado</strong>.</p>` +
    `<p><strong>Motivo:</strong> ${motivo.replace(/</g, '&lt;')}</p>` +
    '<p>Se quiser corrigir os dados ou documentos e tentar de novo, acesse ' +
    '<a href="https://fazumfreela.com.br">fazumfreela.com.br</a>.</p>' +
    '<p style="color:#64748b;font-size:13px">Se não foi você quem se cadastrou, ignore este e-mail.</p>'
  return { assunto, texto, html }
}

async function enviarResend(email: string, assunto: string, texto: string, html: string) {
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
  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [email], subject: assunto, text: texto, html }),
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

  const destino = String(data.email || '').trim().toLowerCase()
  const nome = String(data.nome || '').trim()
  const tipo = data.tipo === 'empresa' ? 'empresa' : data.tipo === 'profissional' ? 'profissional' : ''
  const decisao =
    data.decisao === 'aprovado' || data.decisao === 'aprovada'
      ? 'aprovado'
      : data.decisao === 'recusado' || data.decisao === 'recusada'
        ? 'recusado'
        : ''
  const motivo = String(data.motivo || '').trim()

  if (!destino || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
    return json(400, { ok: false, erro: 'Informe um e-mail válido.' })
  }
  if (!tipo || !decisao) {
    return json(400, { ok: false, erro: 'Não foi possível montar o aviso de cadastro.' })
  }
  if (decisao === 'recusado' && !motivo) {
    return json(400, { ok: false, erro: 'Informe o motivo da recusa.' })
  }

  const { assunto, texto, html } = montarEmail({ nome, tipo, decisao, motivo })
  const enviado = await enviarResend(destino, assunto, texto, html)
  if (!enviado.ok) return json(enviado.status, { ok: false, erro: enviado.erro })
  return json(200, { ok: true })
})