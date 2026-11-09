/** Compara o rosto da selfie com o do documento, no navegador (face-api, carregado só quando usado). */
const MODELOS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1/model/'
/** Distância euclidiana usual do face-api: abaixo de 0,55 tende a ser a mesma pessoa. */
export const LIMITE_MESMO_ROSTO = 0.55

export type ResultadoRosto =
  | { status: 'confere' | 'diferente'; distancia: number; similaridade: number }
  | { status: 'sem_rosto_selfie' | 'sem_rosto_documento' | 'erro' }

type FaceApi = typeof import('@vladmandic/face-api')
let carregando: Promise<FaceApi> | null = null

function carregar() {
  if (!carregando) {
    carregando = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODELOS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELOS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELOS_URL),
      ])
      await aquecer(faceapi)
      return faceapi
    })()
    carregando.catch(() => {
      carregando = null
    })
  }
  return carregando
}

/**
 * No WebGL, o primeiro cálculo de cada rede sai errado (testado em GPU Intel real e no
 * renderizador por software): a selfie, calculada primeiro, "não tinha rosto" na posição normal,
 * o código achava um rosto na foto girada e a comparação dava "não confere" até para a mesma foto.
 * Rodar as três redes uma vez numa imagem neutra resolve — e a comparação em si fica rápida.
 */
async function aquecer(faceapi: FaceApi) {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#888'
  ctx.fillRect(0, 0, 160, 160)
  await faceapi.nets.ssdMobilenetv1.locateFaces(canvas)
  await faceapi.nets.faceLandmark68Net.detectLandmarks(canvas)
  await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(canvas)
}

/** Começa a baixar e aquecer o modelo antes (ex.: ao abrir a etapa de documentos). */
export function prepararComparacaoRostos() {
  void carregar().catch(() => undefined)
}

function imagem(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('imagem'))
    img.src = dataUrl
  })
}

/** Reduz a foto (celular manda 4000px+) e gira, já que muita selfie chega deitada. */
function preparar(img: HTMLImageElement, graus: number) {
  const max = 800
  const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * escala)
  const h = Math.round(img.naturalHeight * escala)
  const deitado = graus === 90 || graus === 270
  const canvas = document.createElement('canvas')
  canvas.width = deitado ? h : w
  canvas.height = deitado ? w : h
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((graus * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return canvas
}

async function descritor(faceapi: FaceApi, dataUrl: string) {
  const img = await imagem(dataUrl)
  for (const graus of [0, 90, 270, 180]) {
    const achou = await faceapi
      .detectSingleFace(preparar(img, graus), new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (achou) return achou.descriptor
  }
  return null
}

export async function compararRostos(documentoDataUrl: string, selfieDataUrl: string): Promise<ResultadoRosto> {
  const tarefa = (async (): Promise<ResultadoRosto> => {
    try {
      const faceapi = await carregar()
      const selfie = await descritor(faceapi, selfieDataUrl)
      if (!selfie) return { status: 'sem_rosto_selfie' }
      const doc = await descritor(faceapi, documentoDataUrl)
      if (!doc) return { status: 'sem_rosto_documento' }
      const distancia = Number(faceapi.euclideanDistance(selfie, doc).toFixed(3))
      const similaridade = Math.max(0, Math.min(100, Math.round((1 - distancia) * 100)))
      return { status: distancia <= LIMITE_MESMO_ROSTO ? 'confere' : 'diferente', distancia, similaridade }
    } catch {
      return { status: 'erro' }
    }
  })()
  const limite = new Promise<ResultadoRosto>((resolve) => window.setTimeout(() => resolve({ status: 'erro' }), 45000))
  return Promise.race([tarefa, limite])
}
