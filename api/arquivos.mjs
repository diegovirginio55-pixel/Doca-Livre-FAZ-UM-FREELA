import { ManagedIdentityCredential } from '@azure/identity'
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob'

const baldes = new Set(['mao-documentos'])
const conta = process.env.BLOB_ACCOUNT || 'stofertacargaprod'

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
  const limpo = decodeURIComponent(path || '').replace(/^\/+/, '')
  if (!limpo || limpo.includes('..')) return ''
  return limpo
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = []
    req.on('data', (parte) => partes.push(parte))
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

export async function atenderArquivo(req, res, caminho) {
  // 1. URL assinada (Supabase createSignedUrl: POST /storage/v1/object/sign/:bucket/:path)
  const signMatch = caminho.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/)
  if (signMatch && req.method === 'POST') {
    const bucket = signMatch[1]
    const path = caminhoSeguro(signMatch[2])
    if (!baldes.has(bucket) || !path) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'Bucket ou arquivo não encontrado' }))
      return
    }
    const publicUrl = `https://${conta}.blob.core.windows.net/${bucket}/${path}`
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ signedURL: publicUrl, signedUrl: publicUrl }))
    return
  }

  // 2. GET ou HEAD público
  const publico = caminho.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (publico && (req.method === 'GET' || req.method === 'HEAD')) {
    const bucket = publico[1]
    const path = caminhoSeguro(publico[2])
    if (!baldes.has(bucket) || !path) {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(302, { location: `https://${conta}.blob.core.windows.net/${bucket}/${path}` })
    res.end()
    return
  }

  // 3. Listar arquivos (Supabase list: POST /storage/v1/object/list/:bucket)
  const lista = caminho.match(/^\/storage\/v1\/object\/list\/([^/]+)$/)
  if (lista && req.method === 'POST') {
    const bucket = lista[1]
    if (!baldes.has(bucket)) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'Bucket não encontrado' }))
      return
    }
    const corpo = await lerCorpo(req)
    const prefixo = String(corpo.prefix || '')
    const nomes = []
    for await (const item of blobs().getContainerClient(bucket).listBlobsFlat({ prefix: prefixo })) {
      const nomeCurto = prefixo ? item.name.replace(new RegExp(`^${prefixo}/?`), '') : item.name
      nomes.push({
        name: nomeCurto,
        id: item.name,
        updated_at: item.properties.lastModified?.toISOString(),
        created_at: item.properties.createdOn?.toISOString(),
        metadata: { size: item.properties.contentLength, mimetype: item.properties.contentType },
      })
      if (nomes.length >= 1000) break
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(nomes))
    return
  }

  // 4. Objetos genéricos: DELETE / GET / POST / PUT
  const objeto = caminho.match(/^\/storage\/v1\/object\/([^/]+)(?:\/(.*))?$/)
  if (!objeto) {
    res.writeHead(404)
    res.end()
    return
  }
  const bucket = objeto[1]
  if (!baldes.has(bucket)) {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Bucket não encontrado' }))
    return
  }

  // DELETE múltiplos prefixes
  if (req.method === 'DELETE' && !objeto[2]) {
    const corpo = await lerCorpo(req)
    const prefixes = Array.isArray(corpo.prefixes) ? corpo.prefixes : []
    const container = blobs().getContainerClient(bucket)
    for (const prefixo of prefixes) {
      const path = caminhoSeguro(String(prefixo))
      if (path) await container.getBlockBlobClient(path).deleteIfExists()
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(prefixes))
    return
  }

  const path = caminhoSeguro(objeto[2] || '')
  if (!path) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Caminho inválido' }))
    return
  }

  if (req.method === 'GET') {
    res.writeHead(302, { location: `https://${conta}.blob.core.windows.net/${bucket}/${path}` })
    res.end()
    return
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const tipo = String(req.headers['content-type'] || 'application/octet-stream')
    await blobs()
      .getContainerClient(bucket)
      .getBlockBlobClient(path)
      .uploadStream(req, 4 * 1024 * 1024, 2, {
        blobHTTPHeaders: { blobContentType: tipo },
      })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ Key: `${bucket}/${path}` }))
    return
  }

  if (req.method === 'DELETE') {
    await blobs().getContainerClient(bucket).getBlockBlobClient(path).deleteIfExists()
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: 'Excluído com sucesso' }))
    return
  }

  res.writeHead(404)
  res.end()
}
