import type { ArquivoMedido, NoArvore, Peso } from './tipos'

export const LIMITE_LEVE = 2000
export const LIMITE_MEDIO = 8000

export function pesoDe(tokens: number): Peso {
  if (tokens <= LIMITE_LEVE) return 'leve'
  if (tokens <= LIMITE_MEDIO) return 'medio'
  return 'pesado'
}

export const ROTULO_PESO: Record<Peso, string> = {
  leve: 'Econômico',
  medio: 'Médio',
  pesado: 'Pesado',
}

function novaPasta(id: string, nome: string): NoArvore {
  return { id, nome, tipo: 'pasta', tokens: 0, linhas: 0, bytes: 0, arquivos: 0, maiorArquivo: 0, peso: 'leve', filhos: [] }
}

function fechar(no: NoArvore) {
  if (no.tipo === 'arquivo') return
  no.filhos.forEach(fechar)
  no.tokens = no.filhos.reduce((soma, f) => soma + f.tokens, 0)
  no.linhas = no.filhos.reduce((soma, f) => soma + f.linhas, 0)
  no.bytes = no.filhos.reduce((soma, f) => soma + f.bytes, 0)
  no.arquivos = no.filhos.reduce((soma, f) => soma + (f.tipo === 'arquivo' ? 1 : f.arquivos), 0)
  no.maiorArquivo = Math.max(0, ...no.filhos.map((f) => f.maiorArquivo))
  no.peso = pesoDe(no.maiorArquivo)
  no.filhos.sort((a, b) => (a.tipo === b.tipo ? b.tokens - a.tokens : a.tipo === 'pasta' ? -1 : 1))
}

export function montarArvore(arquivos: ArquivoMedido[]): NoArvore {
  const raiz = novaPasta('', 'Doca Livre fazumfreela')
  for (const arquivo of arquivos) {
    const partes = arquivo.caminho.split('/')
    let atual = raiz
    partes.slice(0, -1).forEach((parte, i) => {
      const id = partes.slice(0, i + 1).join('/')
      let pasta = atual.filhos.find((f) => f.id === id)
      if (!pasta) {
        pasta = novaPasta(id, parte)
        atual.filhos.push(pasta)
      }
      atual = pasta
    })
    atual.filhos.push({
      id: arquivo.caminho,
      nome: partes[partes.length - 1],
      tipo: 'arquivo',
      tokens: arquivo.tokens,
      linhas: arquivo.linhas,
      bytes: arquivo.bytes,
      arquivos: 1,
      maiorArquivo: arquivo.tokens,
      peso: pesoDe(arquivo.tokens),
      filhos: [],
    })
  }
  fechar(raiz)
  return raiz
}

export function arquivosDe(no: NoArvore): NoArvore[] {
  if (no.tipo === 'arquivo') return [no]
  return no.filhos.flatMap(arquivosDe)
}

export function acharNo(no: NoArvore, id: string): NoArvore | null {
  if (no.id === id) return no
  for (const filho of no.filhos) {
    const achado = acharNo(filho, id)
    if (achado) return achado
  }
  return null
}

export function numero(valor: number) {
  return valor.toLocaleString('pt-BR')
}
