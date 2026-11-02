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
      return faceapi
    })()
    carregando.catch(() => {
      carregando = null
    })
  }
  return carregando
}

function imagem(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('imagem'))
    img.src = dataUrl
  })
}

async function descritor(faceapi: FaceApi, dataUrl: string) {
  const img = await imagem(dataUrl)
  const achou = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
    .withFaceLandmarks()
    .withFaceDescriptor()
  return achou?.descriptor ?? null
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
