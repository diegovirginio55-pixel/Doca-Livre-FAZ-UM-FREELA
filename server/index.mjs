import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { analisarDocumentoCadastro } from './analisarDocumentoCadastro.mjs'
import { enviarCodigoEmail } from './enviarCodigoEmail.mjs'
import { notificarCadastro } from './notificarCadastro.mjs'
import { lerCurriculo } from './lerCurriculo.mjs'

const root = resolve(process.cwd(), 'dist')
const port = Number(process.env.PORT || 4173)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
}

function lerCorpo(req, limite) {
  return new Promise((resolveBody, reject) => {
    const partes = []
    let tamanho = 0
    let estourou = false
    req.on('data', (parte) => {
      tamanho += parte.length
      if (tamanho > limite) {
        estourou = true
        reject(new Error('corpo grande'))
        req.destroy()
        return
      }
      partes.push(parte)
    })
    req.on('end', () => {
      if (!estourou) resolveBody(Buffer.concat(partes).toString('utf8'))
    })
    req.on('error', reject)
  })
}

function arquivoPublico(pathname) {
  const limpo = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '')
  const arquivo = resolve(root, limpo)
  const base = root.endsWith(sep) ? root : root + sep
  if (arquivo !== root && !arquivo.startsWith(base)) return null
  try {
    if (statSync(arquivo).isFile()) return arquivo
  } catch {
    return null
  }
  return null
}

function enviarArquivo(req, res, arquivo) {
  const tipo = types[extname(arquivo)] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': tipo })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(arquivo).pipe(res)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://local')
  if (url.pathname === '/api/portal/enviar-codigo' && req.method === 'POST') {
    try {
      const bruto = await lerCorpo(req, 8000)
      const data = JSON.parse(bruto || '{}')
      const result = await enviarCodigoEmail({
        email: data.email,
        codigo: data.codigo,
        finalidade: data.finalidade,
        acao: data.acao,
        portalRole: data.portalRole,
        verify_token: data.verify_token,
      })
      res.writeHead(result.status || (result.ok ? 200 : 503), {
        'Content-Type': 'application/json; charset=utf-8',
      })
      const corpo = result.ok
        ? {
            ok: true,
            ...(result.verify_token ? { verify_token: result.verify_token } : {}),
            ...(result.portalRole ? { portalRole: result.portalRole } : {}),
            ...(result.email ? { email: result.email } : {}),
          }
        : { ok: false, erro: result.erro }
      res.end(JSON.stringify(corpo))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, erro: 'Não foi possível enviar o e-mail.' }))
    }
    return
  }


  if (url.pathname === '/api/portal/notificar-cadastro' && req.method === 'POST') {
    try {
      const bruto = await lerCorpo(req, 8000)
      const data = JSON.parse(bruto || '{}')
      const result = await notificarCadastro({
        email: data.email,
        nome: data.nome,
        tipo: data.tipo,
        decisao: data.decisao,
        motivo: data.motivo,
      })
      res.writeHead(result.status || (result.ok ? 200 : 503), {
        'Content-Type': 'application/json; charset=utf-8',
      })
      res.end(JSON.stringify(result.ok ? { ok: true } : { ok: false, erro: result.erro }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, erro: 'Não foi possível enviar o e-mail.' }))
    }
    return
  }
  if (url.pathname === '/api/cadastro/analisar-documento' && req.method === 'POST') {
    try {
      const bruto = await lerCorpo(req, 8_000_000)
      const data = JSON.parse(bruto || '{}')
      const result = await analisarDocumentoCadastro({
        nome: data.nome,
        arquivos: data.arquivos,
        contexto: data.contexto,
        tipo: data.tipo,
        cnpj: data.cnpj,
        cidade: data.cidade,
      })
      res.writeHead(result.status || (result.ok ? 200 : 503), {
        'Content-Type': 'application/json; charset=utf-8',
      })
      res.end(
        JSON.stringify(
          result.ok
            ? { ok: true, aceito: result.aceito, motivo: result.motivo, cnh: result.cnh || '' }
            : { ok: false, erro: result.erro },
        ),
      )
    } catch {
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, erro: 'Não foi possível analisar o documento.' }))
      }
    }
    return
  }

  if (url.pathname === '/api/cadastro/ler-curriculo' && req.method === 'POST') {
    try {
      const bruto = await lerCorpo(req, 3_500_000)
      const data = JSON.parse(bruto || '{}')
      const result = await lerCurriculo({ texto: data.texto, imagem: data.imagem, cargos: data.cargos })
      res.writeHead(result.status || (result.ok ? 200 : 503), {
        'Content-Type': 'application/json; charset=utf-8',
      })
      res.end(JSON.stringify(result.ok ? { ok: true, curriculo: result.curriculo } : { ok: false, erro: result.erro }))
    } catch {
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, erro: 'Não foi possível ler o currículo.' }))
      }
    }
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    res.end()
    return
  }

  const arquivo = arquivoPublico(url.pathname) || join(root, 'index.html')
  enviarArquivo(req, res, arquivo)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`fazumfreela em http://0.0.0.0:${port}`)
})
