const OTP_MINUTOS = 10

function ambiente(env) {
  return env ?? process.env
}

export function montarEmailCodigo(finalidade, codigo) {
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
    `Ele vale por ${OTP_MINUTOS} minutos.\n\n` +
    'Se você não solicitou, ignore este e-mail.'
  const html =
    '<p>Seu código Doca Livre fazumfreela é:</p>' +
    `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${codigo}</p>` +
    `<p>Use este código para ${acao}. Vale por ${OTP_MINUTOS} minutos.</p>` +
    '<p style="color:#64748b;font-size:13px">Se você não solicitou, ignore este e-mail.</p>'
  return { assunto, texto, html }
}

export async function enviarCodigoEmail({ email, codigo, finalidade, env }) {
  const destino = String(email || '').trim().toLowerCase()
  const digitos = String(codigo || '').replace(/\D/g, '')
  const tipo = finalidade === 'senha' ? 'senha' : finalidade === 'cadastro' ? 'cadastro' : ''
  if (!destino || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
    return { ok: false, status: 400, erro: 'Informe um e-mail válido.' }
  }
  if (digitos.length !== 6 || tipo === '') {
    return { ok: false, status: 400, erro: 'Não foi possível enviar o e-mail.' }
  }

  const config = ambiente(env)
  const apiKey = String(config.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. O envio ainda não está configurado neste ambiente.',
    }
  }

  const from =
    String(config.RESEND_FROM || '').trim() ||
    String(config.SMTP_FROM || '').trim() ||
    'Doca Livre fazumfreela <onboarding@resend.dev>'
  const { assunto, texto, html } = montarEmailCodigo(tipo, digitos)

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
    if (resposta.status === 200 || resposta.status === 201) return { ok: true, status: 200 }
    return {
      ok: false,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. Tente de novo em instantes.',
    }
  } catch {
    return {
      ok: false,
      status: 503,
      erro: 'Não foi possível enviar o e-mail. Tente de novo em instantes.',
    }
  }
}
