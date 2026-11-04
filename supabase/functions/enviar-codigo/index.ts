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

function montarEmail(finalidade: string, codigo: string) {
  const acao =
    finalidade === 'cadastro'
      ? 'confirmar seu e-mail e concluir o cadastro'
      : 'redefinir sua senha no portal'
  const assunto =
    finalidade === 'cadastro'
      ? 'Doca Livre fazumfreela — código de confirmação de e-mail'
      : 'Doca Livre fazumfreela — código para trocar a senha'
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { ok: false, erro: 'Não foi possível enviar o e-mail.' })

  let data: { email?: string; codigo?: string; finalidade?: string }
  try {
    data = await req.json()
  } catch {
    return json(400, { ok: false, erro: 'Não foi possível enviar o e-mail.' })
  }

  const destino = String(data.email || '').trim().toLowerCase()
  const digitos = String(data.codigo || '').replace(/\D/g, '')
  const tipo = data.finalidade === 'senha' ? 'senha' : data.finalidade === 'cadastro' ? 'cadastro' : ''
  if (!destino || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
    return json(400, { ok: false, erro: 'Informe um e-mail válido.' })
  }
  if (digitos.length !== 6 || !tipo) {
    return json(400, { ok: false, erro: 'Não foi possível enviar o e-mail.' })
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim() ?? ''
  if (!apiKey) {
    return json(503, {
      ok: false,
      erro: 'Não foi possível enviar o e-mail. O envio ainda não está configurado neste ambiente.',
    })
  }

  const from =
    Deno.env.get('RESEND_FROM')?.trim() ||
    Deno.env.get('SMTP_FROM')?.trim() ||
    'Doca Livre fazumfreela <onboarding@resend.dev>'
  const { assunto, texto, html } = montarEmail(tipo, digitos)

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [destino],
        subject: assunto,
        text: texto,
        html,
      }),
    })
    if (resposta.status === 200 || resposta.status === 201) return json(200, { ok: true })
    if (resposta.status === 401 || resposta.status === 403 || resposta.status === 422) {
      return json(503, {
        ok: false,
        erro: 'Não foi possível enviar o e-mail. O remetente ainda não está liberado para este endereço.',
      })
    }
    return json(503, { ok: false, erro: 'Não foi possível enviar o e-mail. Tente de novo em instantes.' })
  } catch {
    return json(503, { ok: false, erro: 'Não foi possível enviar o e-mail. Tente de novo em instantes.' })
  }
})
