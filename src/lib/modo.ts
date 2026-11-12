/**
 * Modo do app:
 *  - real: só cadastros reais, vindos do banco, com login no servidor.
 *  - demo: dados fictícios (seed) só neste navegador, sem nenhum acesso ao banco.
 * Antes os dois se misturavam e as contas demo (com senha publicada) abriam os dados reais.
 */
export type Modo = 'real' | 'demo'

const CHAVE_MODO = 'mao-modo'

export function modoAtual(): Modo {
  try {
    return localStorage.getItem(CHAVE_MODO) === 'demo' ? 'demo' : 'real'
  } catch {
    return 'real'
  }
}

export function emDemo() {
  return modoAtual() === 'demo'
}

/**
 * Link da equipe: abrir o site em /demo (ou com ?demo) já entra na demonstração. O botão não fica
 * à vista do público desde a abertura dos cadastros. Chamado antes de o app montar.
 */
export function entrarNaDemoPeloLink() {
  try {
    const { pathname, search } = window.location
    const pediu = pathname.replace(/\/+$/, '') === '/demo' || new URLSearchParams(search).has('demo')
    if (!pediu) return
    if (localStorage.getItem(CHAVE_MODO) !== 'demo') {
      localStorage.setItem(CHAVE_MODO, 'demo')
      sessionStorage.removeItem('mao-portal-ativo')
    }
    window.history.replaceState(null, '', '/')
  } catch {
    /* sem storage: segue no modo real */
  }
}

/** Troca de modo recarregando a página: estado, cliente do banco e sessão começam do zero. */
export function trocarModo(modo: Modo) {
  try {
    if (modo === 'demo') localStorage.setItem(CHAVE_MODO, 'demo')
    else localStorage.removeItem(CHAVE_MODO)
    sessionStorage.removeItem('mao-portal-ativo')
  } catch {
    /* sem storage: segue no modo real */
  }
  window.location.reload()
}
