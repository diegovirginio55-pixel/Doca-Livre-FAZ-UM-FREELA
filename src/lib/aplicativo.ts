/**
 * Aplicativo Android do fazumfreela (pasta android/): o que o site precisa saber sobre ele.
 * O instalador fica em public/app (gerado por android/gerar-apk.ps1) e a prova de que o app é deste site em
 * public/.well-known/assetlinks.json.
 */

export const PACOTE_ANDROID = 'br.com.docalivre.fazumfreela'
export const APK_URL = '/app/fazumfreela.apk'
export const VERSAO_URL = '/app/versao.json'

const CHAVE_NO_APP = 'fazumfreela.noApp'
/** Marca que o app Android põe nos endereços que ele abre (abertura, atalhos, widget e avisos). */
const MARCA_DO_APP = 'app'
let noAppNestaPagina = false

/**
 * O app abre o site com o "referrer" android-app://<pacote> e, nos endereços dele, com ?app=android. Só a
 * primeira página recebe isso, então a marca fica guardada na sessão (cada abertura do app é uma sessão nova).
 */
function marcarSeNoApp() {
  try {
    const pelaOrigem =
      typeof document !== 'undefined' && document.referrer.startsWith(`android-app://${PACOTE_ANDROID}`)
    const url = new URL(window.location.href)
    const pelaMarca = url.searchParams.get(MARCA_DO_APP) === 'android'
    if (pelaMarca) {
      url.searchParams.delete(MARCA_DO_APP)
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
    if (pelaOrigem || pelaMarca) {
      noAppNestaPagina = true
      sessionStorage.setItem(CHAVE_NO_APP, '1')
    }
  } catch {
    /* sem sessionStorage */
  }
}
marcarSeNoApp()

export function estaNoApp() {
  if (noAppNestaPagina) return true
  try {
    return sessionStorage.getItem(CHAVE_NO_APP) === '1'
  } catch {
    return false
  }
}

/**
 * Aberto como "app instalado pelo navegador" (atalho do Chrome/Edge, "Adicionar à Tela de Início" do iPhone)?
 * Desde o app Android, isso não abre mais o sistema: só o APK. O APK também roda em tela cheia, por isso ele é
 * reconhecido antes (estaNoApp).
 */
export function abertoComoAppDoNavegador() {
  if (estaNoApp()) return false
  try {
    const modos = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
    if (modos.some((modo) => window.matchMedia(`(display-mode: ${modo})`).matches)) return true
  } catch {
    /* navegador sem matchMedia */
  }
  return typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function ehAndroid() {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '')
}

export function ehIphone() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
}

/**
 * Link que entrega o código ao app já instalado (tela "App do fazumfreela"). Sem o app, o Chrome baixa o
 * instalador no lugar.
 */
export function linkDeAtivacao(token: string) {
  const apk = `${window.location.origin}${APK_URL}`
  return (
    `intent://ativar?t=${encodeURIComponent(token)}#Intent;scheme=fazumfreela;package=${PACOTE_ANDROID};` +
    `S.browser_fallback_url=${encodeURIComponent(apk)};end`
  )
}

export type VersaoDoApp = { versao: string; tamanhoMb?: number; geradoEm?: string }

export async function lerVersaoDoApp(): Promise<VersaoDoApp | null> {
  try {
    const r = await fetch(VERSAO_URL, { cache: 'no-store' })
    if (!r.ok) return null
    const j = (await r.json()) as VersaoDoApp
    return j && typeof j.versao === 'string' ? j : null
  } catch {
    return null
  }
}

// ---------- Aba pedida pelo endereço (atalhos e avisos do app: /?aba=vagas) ----------

let abaDoEndereco: string | null = (() => {
  try {
    return new URLSearchParams(window.location.search).get('aba')
  } catch {
    return null
  }
})()

/** A aba que o endereço pediu, se for uma das abas deste portal. Não apaga (o React pode chamar duas vezes). */
export function abaPedida<T extends string>(validas: readonly T[]): T | null {
  return abaDoEndereco && (validas as readonly string[]).includes(abaDoEndereco) ? (abaDoEndereco as T) : null
}

/** Depois de abrir o portal: tira o ?aba= do endereço, para o F5 não voltar sempre para a mesma aba. */
export function esquecerAbaPedida() {
  if (!abaDoEndereco) return
  abaDoEndereco = null
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('aba')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch {
    /* ignore */
  }
}
