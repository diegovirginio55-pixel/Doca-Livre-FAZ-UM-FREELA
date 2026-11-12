// Tema claro / escuro, como no WMS Doca Livre: fica salvo no aparelho e vale para todo o site.
// O index.html aplica o tema salvo antes de a página aparecer, para a tela não piscar clara.
import { useCallback, useEffect, useState } from 'react'

export type Tema = 'claro' | 'escuro'

const CHAVE = 'fazumfreela.tema'
const EVENTO = 'fazumfreela:tema'

export function temaAtual(): Tema {
  return document.documentElement.getAttribute('data-tema') === 'escuro' ? 'escuro' : 'claro'
}

export function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute('data-tema', tema)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'escuro' ? '#0a0a0b' : '#000000')
  try {
    localStorage.setItem(CHAVE, tema)
  } catch {
    /* sem localStorage: vale só até fechar a página */
  }
  window.dispatchEvent(new Event(EVENTO))
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(temaAtual)
  useEffect(() => {
    const ouvir = () => setTema(temaAtual())
    window.addEventListener(EVENTO, ouvir)
    return () => window.removeEventListener(EVENTO, ouvir)
  }, [])
  const alternar = useCallback(() => aplicarTema(temaAtual() === 'escuro' ? 'claro' : 'escuro'), [])
  return { tema, alternar }
}
