import { createHmac, timingSafeEqual } from 'node:crypto'
import { ManagedIdentityCredential } from '@azure/identity'
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob'
import { pool } from './migrar.mjs'
import { contaDoPedido, ehGestao } from './rotasAuth.mjs'

const baldes = new Set(['mao-documentos'])
const conta = process.env.BLOB_ACCOUNT || 'stofertacargaprod'
const LIMITE_UPLOAD = 12 * 1024 * 1024

// ---------- Link assinado ----------
// O supabase-js monta a URL como `${API}/storage/v1` + signedURL. Antes devolvíamos a URL
// absoluta do Blob, e o resultado ("…/storage/v1https://…blob…") não abria: o admin não
// conseguia ver nenhum documento enviado no cadastro.

function segredoAssinatura() {
  return String(
    process.env.STORAGE_SIGN_SECRET || process.env.AZURE_STORAGE_KEY || process.env.PGPASSWORD || '',
  )
}

function assinatura(bucket, path, expira) {
  return createHmac('sha256', segredoAssinatura()).update(`${bucket}/${path}:${expira}`).digest('base64url')
}

export function tokenArquivo(bucket, path, segundos) {
  const expira = Math.floor(Date.now() / 1000) + segundos
  return `${expira}.${assinatura(bucket, path, expira)}`
}

export function tokenArquivoValido(bucket, path, token) {
  if (!segredoAssinatura()) return false
  const [expiraTxt, recebida] = String(token || '').split('.')
  const expira = Number(expiraTxt)
  if (!recebida || !Number.isInteger(expira) || expira < Date.now() / 1000) return false
  const certa = Buffer.from(assinatura(bucket, path, expira))
  const veio = Buffer.from(recebida)
  return certa.length === veio.length && timingSafeEqual(certa, veio)
}

let servico

function blobs() {
  if (!servico) {
    if (process.env.AZURE_STORAGE_KEY) {
      try {
        const credencial = new StorageSharedKeyCredential(conta, process.env.AZURE_STORAGE_KEY)
        servico = new BlobServiceClient(`https://${conta}.blob.core.windows.net`, credencial)
        return servico
      } catch (err) {
        console.warn('Falha ao usar StorageSharedKeyCredential:', err)
      }
    }
    const credencial = new ManagedIdentityCredential(process.env.AZURE_CLIENT_ID)
    servico = new BlobServiceClient(`https://${conta}.blob.core.windows.net`, credencial)
  }
  return servico
}

function caminhoSeguro(path) {
  let limpo = ''
  try {
    limpo = decodeURIComponent(path || '').replace(/^\/+/, '')
  } catch {
    return ''
  }
  if (!limpo || limpo.includes('..') || limpo.includes('\\')) return ''
  return limpo
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = []
    let total = 0
    req.on('data', (parte) => {
      total += parte.length
      if (total > 100_000) {
        reject(new Error('Corpo muito grande'))
        req.destroy()
        return
      }
      partes.push(parte)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'))
      } catch (erro) {
        reject(erro)
      }
    })
    req.on('error', reject)
  })
}

function json(res, status, corpo) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(corpo))
}

/**
 * Os arquivos ficam em `<profissional|empresa>/<id do perfil>/...`. Só o dono do perfil
 * (ou o admin) mexe neles. Antes qualquer um com a chave pública do site listava, baixava,
 * trocava e apagava os documentos de todo mundo.
 */
async function podeMexer(dono, path) {
  if (ehGestao(dono.role)) return true
  const [tipo, perfilId] = String(path).split('/')
  if (!perfilId) return false
  const tabela = tipo === 'profissional' ? 'mao_profissionais' : tipo === 'empresa' ? 'mao_empresas' : ''
  if (!tabela) return false
  const { rowCount } = await pool.query(`select 1 from ${tabela} where id = $1 and user_id = $2`, [perfilId, dono.id])
  return rowCount > 0
}

export async function atenderArquivo(req, res, caminho) {
  // 1. Download do link assinado: GET com ?token=, sem login (o token protege; <img> e nova
  //    aba não mandam cabeçalho).
  const signMatch = caminho.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/)
  if (signMatch && (req.method === 'GET' || req.method === 'HEAD')) {
    const bucket = signMatch[1]
    const path = caminhoSeguro(signMatch[2])
    const token = new URL(req.url || '/', 'http://local').searchParams.get('token')
    if (!baldes.has(bucket) || !path || !tokenArquivoValido(bucket, path, token)) {
      json(res, 403, { error: 'Link do arquivo inválido ou expirado' })
      return
    }
    const blob = blobs().getContainerClient(bucket).getBlobClient(path)
    try {
      if (req.method === 'HEAD') {
        const props = await blob.getProperties()
        res.writeHead(200, {
          'content-type': props.contentType || 'application/octet-stream',
          'content-length': String(props.contentLength ?? 0),
          'cache-control': 'private, max-age=300',
        })
        res.end()
        return
      }
      const baixado = await blob.download()
      res.writeHead(200, {
        'content-type': baixado.contentType || 'application/octet-stream',
        ...(baixado.contentLength != null ? { 'content-length': String(baixado.contentLength) } : {}),
        'cache-control': 'private, max-age=300',
      })
      baixado.readableStreamBody.pipe(res)
    } catch (erro) {
      if (erro?.statusCode === 404) {
        json(res, 404, { error: 'Arquivo não encontrado' })
        return
      }
      throw erro
    }
    return
  }

  // Daqui para baixo: só com login.
  const dono = await contaDoPedido(req)
  if (!dono) {
    json(res, 401, { error: 'Entre na sua conta para acessar arquivos' })
    return
  }

  // 2. Gerar link assinado (Supabase createSignedUrl: POST /storage/v1/object/sign/:bucket/:path)
  if (signMatch && req.method === 'POST') {
    const bucket = signMatch[1]
    const path = caminhoSeguro(signMatch[2])
    if (!baldes.has(bucket) || !path) {
      json(res, 404, { error: 'Bucket ou arquivo não encontrado' })
      return
    }
    if (!(await podeMexer(dono, path))) {
      json(res, 403, { error: 'Sem permissão para este arquivo' })
      return
    }
    if (!segredoAssinatura()) {
      json(res, 500, { error: 'Assinatura de arquivo não configurada' })
      return
    }
    const corpo = await lerCorpo(req).catch(() => ({}))
    const segundos = Math.min(Math.max(Number(corpo.expiresIn) || 1800, 60), 24 * 3600)
    // Caminho relativo: o supabase-js prefixa com `${API}/storage/v1`.
    json(res, 200, { signedURL: `/object/sign/${bucket}/${path}?token=${tokenArquivo(bucket, path, segundos)}` })
    return
  }

  // 3. Listar arquivos (Supabase list: POST /storage/v1/object/list/:bucket)
  const lista = caminho.match(/^\/storage\/v1\/object\/list\/([^/]+)$/)
  if (lista && req.method === 'POST') {
    const bucket = lista[1]
    if (!baldes.has(bucket)) {
      json(res, 404, { error: 'Bucket não encontrado' })
      return
    }
    const corpo = await lerCorpo(req)
    const prefixo = caminhoSeguro(String(corpo.prefix || '')).replace(/\/+$/, '')
    if (!prefixo || !(await podeMexer(dono, prefixo))) {
      json(res, 403, { error: 'Sem permissão para esta pasta' })
      return
    }
    const nomes = []
    for await (const item of blobs().getContainerClient(bucket).listBlobsFlat({ prefix: `${prefixo}/` })) {
      nomes.push({
        name: item.name.slice(prefixo.length + 1),
        id: item.name,
        updated_at: item.properties.lastModified?.toISOString(),
        created_at: item.properties.createdOn?.toISOString(),
        metadata: { size: item.properties.contentLength, mimetype: item.properties.contentType },
      })
      if (nomes.length >= 1000) break
    }
    json(res, 200, nomes)
    return
  }

  // 4. Objetos: POST/PUT (enviar) e DELETE
  const objeto = caminho.match(/^\/storage\/v1\/object\/([^/]+)(?:\/(.*))?$/)
  if (!objeto || !baldes.has(objeto[1])) {
    json(res, 404, { error: 'Bucket não encontrado' })
    return
  }
  const bucket = objeto[1]

  if (req.method === 'DELETE' && !objeto[2]) {
    const corpo = await lerCorpo(req)
    const prefixes = Array.isArray(corpo.prefixes) ? corpo.prefixes : []
    const container = blobs().getContainerClient(bucket)
    const apagados = []
    for (const prefixo of prefixes) {
      const path = caminhoSeguro(String(prefixo))
      if (path && (await podeMexer(dono, path))) {
        await container.getBlockBlobClient(path).deleteIfExists()
        apagados.push(path)
      }
    }
    json(res, 200, apagados.map((name) => ({ name })))
    return
  }

  const path = caminhoSeguro(objeto[2] || '')
  if (!path) {
    json(res, 400, { error: 'Caminho inválido' })
    return
  }
  if (!(await podeMexer(dono, path))) {
    json(res, 403, { error: 'Sem permissão para este arquivo' })
    return
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    if (Number(req.headers['content-length'] || 0) > LIMITE_UPLOAD) {
      json(res, 413, { error: 'Arquivo grande demais' })
      return
    }
    const tipo = String(req.headers['content-type'] || 'application/octet-stream')
    await blobs()
      .getContainerClient(bucket)
      .getBlockBlobClient(path)
      .uploadStream(req, 4 * 1024 * 1024, 2, { blobHTTPHeaders: { blobContentType: tipo } })
    json(res, 200, { Key: `${bucket}/${path}` })
    return
  }

  if (req.method === 'DELETE') {
    await blobs().getContainerClient(bucket).getBlockBlobClient(path).deleteIfExists()
    json(res, 200, { message: 'Excluído com sucesso' })
    return
  }

  json(res, 404, { error: 'Não encontrado' })
}
