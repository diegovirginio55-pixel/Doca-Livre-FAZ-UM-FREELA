import { analisarDocumentoCadastro } from '../_shared/analisarDocumentoCadastro.mjs'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { ok: false, erro: 'Não foi possível analisar o documento.' })

  let data: {
    nome?: string
    arquivos?: { papel?: string; mime?: string; dados?: string }[]
    contexto?: string
    tipo?: string
    cnpj?: string
    cidade?: string
    cpf?: string
  }
  try {
    data = await req.json()
  } catch {
    return json(400, { ok: false, erro: 'Não foi possível analisar o documento.' })
  }

  const result = await analisarDocumentoCadastro({
    nome: data.nome,
    arquivos: data.arquivos,
    contexto: data.contexto,
    tipo: data.tipo,
    cnpj: data.cnpj,
    cidade: data.cidade,
    cpf: data.cpf,
    env: {
      GEMINI_API_KEY: Deno.env.get('GEMINI_API_KEY') ?? '',
      VITE_GEMINI_API_KEY: Deno.env.get('VITE_GEMINI_API_KEY') ?? '',
    },
  })

  if (!result.ok) return json(result.status || 503, { ok: false, erro: result.erro })
  return json(200, { ok: true, aceito: result.aceito, motivo: result.motivo, cnh: result.cnh || '' })
})
