import http from 'node:http'
import https from 'node:https'
import { timingSafeEqual } from 'node:crypto'
import { pool } from './migrar.mjs'
import { atenderArquivo } from './arquivos.mjs'
import { enviarCodigoEmail } from './server-functions/enviarCodigoEmail.mjs'
import { notificarCadastro } from './server-functions/notificarCadastro.mjs'
import { analisarDocumentoCadastro } from './server-functions/analisarDocumentoCadastro.mjs'
import { lerCurriculo } from './server-functions/lerCurriculo.mjs'

const port = Number(process.env.PORT || 8080)

const tabelas = [
  'mao_usuarios',
  'mao_email_codigos',
  'mao_permissoes',
  'mao_hierarquia_niveis',
  'mao_org_nos',
  'mao_grupos_hierarquia',
  'mao_grupos_hierarquia_membros',
  'mao_app_state',
  'mao_contas',
  'mao_profissionais',
  'mao_empresas',
  'mao_documentos',
]
const copiaPermitida = new Set(tabelas)

function lerCorpo(req, limite = 10_000_000) {
  return new Promise((resolve, reject) => {
    const partes = []
    let total = 0
    req.on('data', (parte) => {
      total += parte.length
      if (total > limite) {
        reject(new Error('Corpo muito grande'))
        req.destroy()
        return
      }
      partes.push(parte)
    })
    req.on('end', () => {
      try {
        const str = Buffer.concat(partes).toString('utf8')
        resolve(str ? JSON.parse(str) : {})
      } catch (erro) {
        reject(erro)
      }
    })
    req.on('error', reject)
  })
}

function segredoConfere(esperado, recebido) {
  const certo = String(esperado || '')
  const valor = String(recebido || '')
  if (!certo || valor.length !== certo.length) return false
  return timingSafeEqual(Buffer.from(valor), Buffer.from(certo))
}

function cors(origemPedido) {
  return {
    'access-control-allow-origin': origemPedido || '*',
    'access-control-allow-headers':
      'authorization, apikey, content-type, prefer, range, accept, accept-profile, content-profile, x-client-info, x-upsert, cache-control',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-expose-headers': 'content-range, content-location, location, preference-applied',
    'access-control-max-age': '86400',
  }
}

async function colunasDaTabela(tabela) {
  const res = await pool.query(
    `select column_name, data_type, is_nullable from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [tabela],
  )
  return res.rows
}

function valorPg(tipo, anulavel, valor) {
  const texto = tipo === 'text' || tipo === 'character varying' || tipo === 'character'
  if (valor === '') {
    if (tipo === 'boolean') return false
    if (!texto)
      return anulavel === 'NO' &&
        (tipo === 'integer' || tipo === 'bigint' || tipo === 'smallint' || tipo === 'numeric')
        ? 0
        : null
  }
  if (valor !== null && (tipo === 'jsonb' || tipo === 'json')) {
    if (typeof valor === 'string') {
      try {
        JSON.parse(valor)
        return valor
      } catch {
        return JSON.stringify(valor)
      }
    }
    return JSON.stringify(valor)
  }
  return valor
}

async function gravarTabela(tabela, linhas, conflito) {
  const colunas = await colunasDaTabela(tabela)
  const nomes = new Set(colunas.map((c) => c.column_name))
  const tipos = new Map(colunas.map((c) => [c.column_name, c.data_type]))
  const nulos = new Map(colunas.map((c) => [c.column_name, c.is_nullable]))
  const chaves = (Array.isArray(conflito) ? conflito : ['id']).filter((nome) => nomes.has(nome))
  if (!chaves.length) throw new Error('sem_chave')
  let gravadas = 0
  for (const linha of linhas) {
    if (!chaves.every((nome) => linha[nome] !== undefined && linha[nome] !== null)) continue
    const pares = Object.entries(linha).filter(
      ([nome, valor]) => nomes.has(nome) && valor !== undefined,
    )
    const campos = pares.map(([nome]) => `"${nome}"`)
    const valores = pares.map(([, valor], i) =>
      valorPg(tipos.get(pares[i][0]), nulos.get(pares[i][0]), valor),
    )
    const marcas = pares.map((_, i) => `$${i + 1}`)
    const atualizaveis = pares.filter(([nome]) => !chaves.includes(nome))
    const acao = atualizaveis.length
      ? `do update set ${atualizaveis.map(([nome]) => `"${nome}" = excluded."${nome}"`).join(', ')}`
      : 'do nothing'
    await pool.query(
      `insert into "${tabela}" (${campos.join(', ')}) values (${marcas.join(', ')})
       on conflict (${chaves.map((nome) => `"${nome}"`).join(', ')}) ${acao}`,
      valores,
    )
    gravadas += 1
  }
  return gravadas
}

async function contagens() {
  const out = {}
  for (const tabela of tabelas) {
    try {
      const res = await pool.query(`select count(*)::int as n from ${tabela}`)
      out[tabela] = res.rows[0].n
    } catch {
      out[tabela] = -1
    }
  }
  return out
}

function encaminhar(req, res, base, caminho, tirar = []) {
  const alvo = new URL(caminho, base)
  const lib = alvo.protocol === 'https:' ? https : http
  const headers = { ...req.headers, host: alvo.host }
  for (const nome of tirar) delete headers[nome]
  const pre = lib.request(alvo, { method: req.method, headers }, (up) => {
    const saida = { ...up.headers, ...cors(req.headers.origin) }
    res.writeHead(up.statusCode || 502, saida)
    up.pipe(res)
  })
  pre.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, erro: 'Falha ao encaminhar PostgREST' }))
  })
  req.pipe(pre)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://local')
  const caminho = url.pathname

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors(req.headers.origin))
    res.end()
    return
  }

  // 1. Health check
  if (caminho === '/saude' || caminho === '/') {
    if (process.env.MIGRACAO_ERRO) {
      res.writeHead(500, { 'content-type': 'application/json', ...cors(req.headers.origin) })
      res.end(JSON.stringify({ ok: false, erro: String(process.env.MIGRACAO_ERRO).slice(0, 300) }))
      return
    }
    try {
      const dados = await contagens()
      let rest = false
      try {
        const prova = await fetch('http://127.0.0.1:3001/mao_contas?select=id&limit=1')
        rest = prova.ok
      } catch {
        rest = false
      }
      res.writeHead(200, { 'content-type': 'application/json', ...cors(req.headers.origin) })
      res.end(
        JSON.stringify({
          ok: true,
          sistema: 'fazumfreela',
          rest,
          contagens: dados,
        }),
      )
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Falha no banco'
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, erro: mensagem }))
    }
    return
  }

  // 2. Cópia de tabelas
  if (caminho === '/copiar' && req.method === 'POST') {
    if (!segredoConfere(process.env.IMPORT_TOKEN, req.headers['x-importar'])) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, erro: 'Não encontrado' }))
      return
    }
    try {
      const corpo = await lerCorpo(req)
      const tabela = String(corpo.tabela || '')
      if (!copiaPermitida.has(tabela) || !Array.isArray(corpo.linhas)) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, erro: 'Tabela inválida' }))
        return
      }
      const gravadas = await gravarTabela(tabela, corpo.linhas, corpo.conflito)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, tabela, gravadas }))
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Falha ao gravar'
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, erro: mensagem }))
    }
    return
  }

  // 3. Validação de API Key (permite requisições públicas de storage GET ou HEAD)
  const publicoStorage =
    caminho.startsWith('/storage/v1/object/public/') &&
    (req.method === 'GET' || req.method === 'HEAD')
  if (
    process.env.ANON_KEY &&
    !publicoStorage &&
    !segredoConfere(process.env.ANON_KEY, req.headers.apikey || url.searchParams.get('apikey'))
  ) {
    res.writeHead(401, { 'content-type': 'application/json', ...cors(req.headers.origin) })
    res.end(JSON.stringify({ message: 'Chave inválida' }))
    return
  }

  // 4. Edge Functions e rotas do portal
  if (caminho === '/functions/v1/enviar-codigo' || caminho === '/api/portal/enviar-codigo') {
    try {
      const corpo = await lerCorpo(req, 8000)
      const resultado = await enviarCodigoEmail(corpo)
      res.writeHead(resultado.status || (resultado.ok ? 200 : 503), {
        'content-type': 'application/json',
        ...cors(req.headers.origin),
      })
      res.end(JSON.stringify(resultado))
    } catch {
      res.writeHead(400, { 'content-type': 'application/json', ...cors(req.headers.origin) })
      res.end(JSON.stringify({ ok: false, erro: 'Falha ao processar código' }))
    }
    return
  }

  if (caminho === '/functions/v1/notificar-cadastro' || caminho === '/api/portal/notificar-cadastro') {
    try {
      const corpo = await lerCorpo(req, 8000)
      const resultado = await notificarCadastro(corpo)
      res.writeHead(resultado.status || (resultado.ok ? 200 : 503), {
        'content-type': 'application/json',
        ...cors(req.headers.origin),
      })
      res.end(JSON.stringify(resultado))
    } catch {
      res.writeHead(400, { 'content-type': 'application/json', ...cors(req.headers.origin) })
      res.end(JSON.stringify({ ok: false, erro: 'Falha ao notificar cadastro' }))
    }
    return
  }

  if (caminho === '/functions/v1/analisar-documento' || caminho === '/api/cadastro/analisar-documento') {
    try {
      const corpo = await lerCorpo(req, 8_000_000)
      const resultado = await analisarDocumentoCadastro(corpo)
      res.writeHead(resultado.status || (resultado.ok ? 200 : 503), {
        'content-type': 'application/json',
        ...cors(req.headers.origin),
      })
      res.end(JSON.stringify(resultado))
    } catch {
      res.writeHead(400, { 'content-type': 'application/json', ...cors(req.headers.origin) })
      res.end(JSON.stringify({ ok: false, erro: 'Falha ao analisar documento' }))
    }
    return
  }

  if (caminho === '/api/cadastro/ler-curriculo') {
    try {
      const corpo = await lerCorpo(req, 3_500_000)
      const resultado = await lerCurriculo(corpo)
      res.writeHead(resultado.status || (resultado.ok ? 200 : 503), {
        'content-type': 'application/json',
        ...cors(req.headers.origin),
      })
      res.end(JSON.stringify(resultado))
    } catch {
      res.writeHead(400, { 'content-type': 'application/json', ...cors(req.headers.origin) })
      res.end(JSON.stringify({ ok: false, erro: 'Falha ao ler currículo' }))
    }
    return
  }

  // 5. REST (PostgREST)
  if (caminho.startsWith('/rest/v1')) {
    const resto = caminho.slice('/rest/v1'.length) || '/'
    encaminhar(req, res, 'http://127.0.0.1:3001', `${resto}${url.search}`, ['authorization'])
    return
  }

  // 6. Storage (Azure Blob)
  if (caminho.startsWith('/storage/v1')) {
    const corsArquivo = cors(req.headers.origin)
    const writeHeadOriginal = res.writeHead.bind(res)
    res.writeHead = (status, ...resto) => {
      const ultimo = resto[resto.length - 1]
      if (ultimo && typeof ultimo === 'object' && !Array.isArray(ultimo)) {
        resto[resto.length - 1] = { ...corsArquivo, ...ultimo }
      } else {
        resto.push(corsArquivo)
      }
      return writeHeadOriginal(status, ...resto)
    }
    try {
      await atenderArquivo(req, res, caminho)
    } catch (e) {
      console.error('[storage error]', e)
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: 'Falha no arquivo', erro: e?.message || String(e) }))
    }
    return
  }

  res.writeHead(404, { 'content-type': 'application/json', ...cors(req.headers.origin) })
  res.end(JSON.stringify({ ok: false, erro: 'Não encontrado' }))
})

server.on('upgrade', (req, socket) => {
  socket.destroy()
})

server.listen(port, '0.0.0.0', () => {
  console.log(`fazumfreela-api escutando na porta ${port}`)
})
