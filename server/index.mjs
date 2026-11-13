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
  // Instalador do app Android (public/app, gerado por android/gerar-apk.ps1).
  '.apk': 'application/vnd.android.package-archive',
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
  const extensao = extname(arquivo)
  const tipo = types[extensao] || 'application/octet-stream'
  const cabecalhos = { 'Content-Type': tipo }
  if (extensao === '.apk') {
    // tamanho para o celular mostrar o progresso; sempre a versão mais nova
    cabecalhos['Content-Length'] = statSync(arquivo).size
    cabecalhos['Content-Disposition'] = 'attachment; filename="fazumfreela.apk"'
    cabecalhos['Cache-Control'] = 'no-cache'
  } else if (arquivo.endsWith(`${sep}app${sep}versao.json`)) {
    cabecalhos['Cache-Control'] = 'no-cache'
  }
  res.writeHead(200, cabecalhos)
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
