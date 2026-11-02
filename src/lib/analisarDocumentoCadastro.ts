import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { loadSupabaseConfig } from './supabaseConfig'

export type PapelDocumento = 'documento' | 'verso' | 'selfie'

export type FotoDocumento = {
  nome: string
  mime: 'image/jpeg' | 'image/heic' | 'image/heif' | 'application/pdf'
  dados: string
}

export const ACCEPT_DOCUMENTO_CADASTRO =
  'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf'

function ehPdf(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function ehHeic(file: File) {
  return /^image\/hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

function ehImagemComum(file: File) {
  return /^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)
}

function lerBinario(file: File, mime: FotoDocumento['mime']) {
  if (file.size > 3_500_000) return Promise.reject(new Error('O arquivo ficou grande demais. Envie um menor.'))
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer)
    let binario = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    const dados = btoa(binario).replace(/\s/g, '')
    if (dados.length < 80) throw new Error('Não foi possível ler o arquivo.')
    return { nome: file.name, mime, dados }
  })
}

async function lerPdfComoJpeg(file: File): Promise<FotoDocumento> {
  if (file.size > 12_000_000) throw new Error('O arquivo ficou grande demais. Envie um menor.')
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const total = Math.min(pdf.numPages, 2)
  if (total < 1) throw new Error('Não foi possível ler o PDF.')
  const folhas: HTMLCanvasElement[] = []
  for (let numero = 1; numero <= total; numero += 1) {
    const page = await pdf.getPage(numero)
    const base = page.getViewport({ scale: 1 })
    const escala = Math.min(2, 1200 / Math.max(base.width, 1))
    const viewport = page.getViewport({ scale: escala })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    await page.render({ canvas, viewport }).promise
    folhas.push(canvas)
  }
  const largura = Math.max(...folhas.map((folha) => folha.width))
  const altura = folhas.reduce((soma, folha) => soma + folha.height, 0)
  const junto = document.createElement('canvas')
  junto.width = largura
  junto.height = altura
  const ctx = junto.getContext('2d')
  if (!ctx) throw new Error('Não foi possível ler o PDF.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, largura, altura)
  let topo = 0
  for (const folha of folhas) {
    ctx.drawImage(folha, 0, topo)
    topo += folha.height
  }
  let qualidade = 0.82
  let dados = ''
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    dados = (junto.toDataURL('image/jpeg', qualidade).split(',')[1] || '').replace(/\s/g, '')
    if (dados.length <= 1_800_000) break
    qualidade -= 0.16
  }
  if (dados.length < 80 || dados.length > 2_000_000) {
    throw new Error('O arquivo ficou grande demais. Envie uma foto do documento.')
  }
  return { nome: file.name, mime: 'image/jpeg', dados }
}

export async function lerArquivoCadastro(file: File): Promise<FotoDocumento> {
  if (ehPdf(file)) {
    try {
      return await lerPdfComoJpeg(file)
    } catch (falha) {
      const msg = falha instanceof Error ? falha.message : ''
      if (/password/i.test(msg)) {
        throw new Error('Não foi possível ler o PDF protegido por senha. Envie uma foto do documento.')
      }
      if (/grande demais/.test(msg)) throw falha
      return lerBinario(file, 'application/pdf')
    }
  }
  if (ehImagemComum(file)) return lerFotoDocumento(file)
  if (ehHeic(file)) {
    try {
      return await lerFotoDocumento(file)
    } catch {
      return lerBinario(file, file.type === 'image/heif' ? 'image/heif' : 'image/heic')
    }
  }
  throw new Error('Use uma foto JPG, PNG, WEBP, GIF ou um PDF.')
}

export async function lerFotoDocumento(file: File): Promise<FotoDocumento> {
  const tipoOk = ehImagemComum(file) || ehHeic(file)
  if (!tipoOk) throw new Error('Use uma foto JPG, PNG, WEBP, GIF ou um PDF.')

  const url = URL.createObjectURL(file)
  try {
    const img = await carregarImagem(url)
    const max = 1600
    const escala = Math.min(1, max / Math.max(img.width, img.height))
    const largura = Math.max(1, Math.round(img.width * escala))
    const altura = Math.max(1, Math.round(img.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível ler a foto.')
    ctx.drawImage(img, 0, 0, largura, altura)
    const dados = (canvas.toDataURL('image/jpeg', 0.82).split(',')[1] || '').replace(/\s/g, '')
    if (dados.length < 80 || dados.length > 2_000_000) {
      throw new Error('A foto ficou grande demais. Envie uma imagem menor.')
    }
    return { nome: file.name, mime: 'image/jpeg', dados }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function carregarImagem(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível ler a foto.'))
    img.src = url
  })
}

export async function lerArquivoEmpresa(file: File): Promise<FotoDocumento> {
  return lerArquivoCadastro(file)
}

export async function analisarDocumentoCadastro(input: {
  nome: string
  arquivos: { papel: PapelDocumento; mime: string; dados: string }[]
  contexto?: 'trabalhador' | 'empresa'
  tipo?: string
  cnpj?: string
  cidade?: string
  cpf?: string
}): Promise<{ ok: true; aceito: boolean; motivo: string; cnh: string } | { ok: false; erro: string }> {
  const cfg = await loadSupabaseConfig()
  const tentativas: { url: string; headers: Record<string, string> }[] = []
  if (cfg.url && cfg.anonKey) {
    tentativas.push({
      url: `${cfg.url.replace(/\/$/, '')}/functions/v1/analisar-documento`,
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
      },
    })
  }
  tentativas.push({
    url: '/api/cadastro/analisar-documento',
    headers: { 'Content-Type': 'application/json' },
  })

  let ultimo = 'Não foi possível analisar o documento. Tente de novo.'
  for (const tentativa of tentativas) {
    try {
      const resposta = await fetch(tentativa.url, {
        method: 'POST',
        headers: tentativa.headers,
        body: JSON.stringify(input),
      })
      const texto = await resposta.text()
      type RespostaAnalise = { ok?: boolean; aceito?: boolean; motivo?: string; erro?: string; cnh?: string }
      let data: RespostaAnalise | null = null
      try {
        data = JSON.parse(texto) as RespostaAnalise
      } catch {
        data = null
      }
      if (!data) continue
      if (resposta.ok && data.ok && typeof data.aceito === 'boolean') {
        return { ok: true, aceito: data.aceito, motivo: data.motivo || '', cnh: data.cnh || '' }
      }
      if (data.erro) {
        ultimo = data.erro
        if (resposta.status !== 404) return { ok: false, erro: data.erro }
      }
    } catch {
      /* tenta o próximo caminho */
    }
  }
  return { ok: false, erro: ultimo }
}
