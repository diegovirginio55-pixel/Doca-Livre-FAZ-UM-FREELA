import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

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
  // As rotas de API (código por e-mail, aviso de cadastro, análise por IA) ficam só na API do
  // Azure, com login. Aqui elas respondiam a qualquer um, sem conta.
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, erro: 'Não encontrado' }))
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
