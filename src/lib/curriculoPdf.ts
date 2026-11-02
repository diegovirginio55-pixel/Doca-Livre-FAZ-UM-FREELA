import { cargoLabel } from '../data/categories'
import type { Disponibilidade, Profissional } from './types'

const AMARELO: Cor = [0.976, 0.859, 0]
const PRETO: Cor = [0, 0, 0]
const BRANCO: Cor = [1, 1, 1]
const CINZA: Cor = [0.36, 0.4, 0.44]
const CINZA_CLARO: Cor = [0.69, 0.69, 0.69]

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const DISPONIBILIDADE: { key: keyof Disponibilidade; label: string }[] = [
  { key: 'hoje', label: 'Disponível hoje' },
  { key: 'amanha', label: 'Disponível amanhã' },
  { key: 'estaSemana', label: 'Esta semana' },
  { key: 'finaisDeSemana', label: 'Finais de semana' },
  { key: 'noturno', label: 'Noturno' },
  { key: 'viagens', label: 'Viagens' },
  { key: 'temporario', label: 'Trabalho temporário' },
  { key: 'efetivo', label: 'Efetivo' },
]

type Cor = [number, number, number]
type Fonte = 'F1' | 'F2'

function limpar(texto: string) {
  return texto
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\n\u0020-\u00ff]/g, '')
}

function escaparPdf(texto: string) {
  return limpar(texto).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function latin1(texto: string) {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i += 1) {
    const code = texto.charCodeAt(i)
    bytes[i] = code <= 255 ? code : 63
  }
  return bytes
}

function juntar(partes: Uint8Array[]) {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0)
  const saida = new Uint8Array(total)
  let cursor = 0
  for (const parte of partes) {
    saida.set(parte, cursor)
    cursor += parte.length
  }
  return saida
}

function dataApresentavel(valor: string) {
  const pedaco = valor.slice(0, 10)
  const [ano, mes, dia] = pedaco.split('-')
  const indice = Number(mes) - 1
  if (ano && mes && dia && indice >= 0 && indice < 12) return `${dia}/${mes}/${ano}`
  if (ano && mes && indice >= 0 && indice < 12) return `${MESES[indice]}/${ano}`
  return valor
}

function quebrar(texto: string, max: number) {
  const palavras = limpar(texto).split(/\s+/).filter(Boolean)
  const linhas: string[] = []
  let atual = ''
  for (const palavra of palavras) {
    const proxima = atual ? `${atual} ${palavra}` : palavra
    if (proxima.length > max && atual) {
      linhas.push(atual)
      atual = palavra
    } else {
      atual = proxima
    }
  }
  if (atual) linhas.push(atual)
  return linhas.length ? linhas : ['']
}

class Folha {
  comandos: string[] = []
  y = 710

  constructor(profissional: Profissional) {
    this.ret(0, 748, 595, 94, PRETO)
    this.ret(0, 748, 595, 5, AMARELO)
    this.texto(40, 818, 'CURRÍCULO', 11, 'F2', AMARELO)
    this.texto(430, 818, 'fazumfreela', 11, 'F2', AMARELO)
    const nome = quebrar(profissional.nome, 36).slice(0, 2)
    nome.forEach((linha, indice) => {
      this.texto(40, 794 - indice * 22, linha, 20, 'F2', BRANCO)
    })
    this.texto(
      40,
      794 - nome.length * 22,
      `${profissional.endereco.cidade}/${profissional.endereco.estado}`,
      11,
      'F1',
      CINZA_CLARO,
    )
  }

  ret(x: number, y: number, w: number, h: number, cor: Cor) {
    this.comandos.push(`${cor[0]} ${cor[1]} ${cor[2]} rg`, `${x} ${y} ${w} ${h} re f`)
  }

  texto(x: number, y: number, valor: string, tamanho: number, fonte: Fonte, cor: Cor) {
    this.comandos.push(
      'BT',
      `${cor[0]} ${cor[1]} ${cor[2]} rg`,
      `/${fonte} ${tamanho} Tf`,
      `1 0 0 1 ${x} ${y} Tm`,
      `(${escaparPdf(valor)}) Tj`,
      'ET',
    )
  }

  garantir(altura: number, profissional: Profissional, folhas: Folha[]) {
    if (this.y - altura >= 58) return this
    this.rodape()
    const nova = new Folha(profissional)
    folhas.push(nova)
    return nova
  }

  secao(titulo: string) {
    this.y -= 8
    this.texto(40, this.y, titulo, 12, 'F2', PRETO)
    this.ret(40, this.y - 6, 42, 3, AMARELO)
    this.y -= 24
  }

  linha(valor: string, tamanho: number, fonte: Fonte, cor: Cor, recuo = 40) {
    this.texto(recuo, this.y, valor, tamanho, fonte, cor)
    this.y -= tamanho + 6
  }

  rodape() {
    this.ret(40, 46, 515, 0.6, [0.86, 0.88, 0.9])
    this.texto(40, 30, 'fazumfreela', 9, 'F1', CINZA)
  }

  bytes() {
    return latin1(this.comandos.join('\n'))
  }
}

function montarFolhas(profissional: Profissional) {
  const folhas: Folha[] = []
  let folha = new Folha(profissional)
  folhas.push(folha)

  if (profissional.resumo?.trim()) {
    folha.secao('Resumo')
    for (const linha of quebrar(profissional.resumo, 86)) {
      folha = folha.garantir(20, profissional, folhas)
      folha.linha(linha, 11, 'F1', PRETO)
    }
    folha = folha.garantir(40, profissional, folhas)
  }

  const cargos = profissional.profissoes.length
    ? profissional.profissoes.map(cargoLabel).join(', ')
    : 'Não informado'
  folha.secao('Cargo')
  for (const linha of quebrar(cargos, 86)) {
    folha = folha.garantir(20, profissional, folhas)
    folha.linha(linha, 11, 'F1', PRETO)
  }

  folha = folha.garantir(40, profissional, folhas)
  folha.secao('Experiência')
  if (!profissional.experiencia.length) {
    folha.linha('Não descrita', 11, 'F1', CINZA)
  }
  for (const item of profissional.experiencia) {
    folha = folha.garantir(48, profissional, folhas)
    folha.ret(40, folha.y - 2, 3, 14, AMARELO)
    folha.linha(item.cargo, 12, 'F2', PRETO, 50)
    const ate = !item.fim || item.fim === 'atual' ? 'até o momento' : `a ${dataApresentavel(item.fim)}`
    const periodo = `${item.empresa}  ·  ${dataApresentavel(item.inicio)} ${ate}`
    for (const linha of quebrar(periodo, 80)) {
      folha = folha.garantir(18, profissional, folhas)
      folha.linha(linha, 10, 'F1', CINZA, 50)
    }
    if (item.descricao.trim()) {
      for (const linha of quebrar(item.descricao, 80)) {
        folha = folha.garantir(18, profissional, folhas)
        folha.linha(linha, 10, 'F1', PRETO, 50)
      }
    }
    folha.y -= 6
  }

  folha = folha.garantir(40, profissional, folhas)
  folha.secao('Certificações')
  if (profissional.cnhCategoria) {
    const validade = profissional.cnhValidade ? `, validade ${dataApresentavel(profissional.cnhValidade)}` : ''
    folha = folha.garantir(18, profissional, folhas)
    folha.linha(`CNH ${profissional.cnhCategoria}${validade}`, 11, 'F1', PRETO)
  }
  if (!profissional.certificados.length && !profissional.cnhCategoria) {
    folha.linha('Nenhuma registrada', 11, 'F1', CINZA)
  }
  for (const cert of profissional.certificados) {
    const validade = cert.validade ? `, validade ${dataApresentavel(cert.validade)}` : ''
    folha = folha.garantir(18, profissional, folhas)
    folha.linha(`${cert.tipo}${validade}`, 11, 'F1', PRETO)
  }

  if (profissional.escolaridade) {
    folha = folha.garantir(40, profissional, folhas)
    folha.secao('Escolaridade')
    folha.linha(profissional.escolaridade, 11, 'F1', PRETO)
  }

  if (profissional.habilidades?.length) {
    folha = folha.garantir(40, profissional, folhas)
    folha.secao('Habilidades')
    for (const linha of quebrar(profissional.habilidades.join('  ·  '), 86)) {
      folha = folha.garantir(18, profissional, folhas)
      folha.linha(linha, 11, 'F1', PRETO)
    }
  }

  const disp = DISPONIBILIDADE.filter((item) => profissional.disponibilidade[item.key]).map((item) => item.label)
  folha = folha.garantir(40, profissional, folhas)
  folha.secao('Disponibilidade')
  for (const linha of quebrar(disp.length ? disp.join('  ·  ') : 'Não marcada', 86)) {
    folha = folha.garantir(18, profissional, folhas)
    folha.linha(linha, 11, 'F1', disp.length ? PRETO : CINZA)
  }

  folha.rodape()
  return folhas
}

export function curriculoPdfBytes(profissional: Profissional) {
  const folhas = montarFolhas(profissional)
  const objetos: Uint8Array[] = []
  const idsPagina: number[] = []
  let proximoId = 3

  const fluxos = folhas.map((folha) => {
    const id = proximoId
    proximoId += 1
    const dados = folha.bytes()
    const cabecalho = latin1(`${id} 0 obj\n<< /Length ${dados.length} >>\nstream\n`)
    const rodape = latin1('\nendstream\nendobj\n')
    objetos.push(juntar([cabecalho, dados, rodape]))
    return id
  })

  folhas.forEach(() => {
    idsPagina.push(proximoId)
    proximoId += 1
  })
  const idFonte = proximoId
  const idFonteNegrito = proximoId + 1

  idsPagina.forEach((id, indice) => {
    objetos.push(
      latin1(
        `${id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${fluxos[indice]} 0 R /Resources << /Font << /F1 ${idFonte} 0 R /F2 ${idFonteNegrito} 0 R >> >> >>\nendobj\n`,
      ),
    )
  })
  objetos.push(
    latin1(`${idFonte} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`),
  )
  objetos.push(
    latin1(
      `${idFonteNegrito} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`,
    ),
  )

  const catalogo = latin1('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  const paginasObj = latin1(
    `2 0 obj\n<< /Type /Pages /Kids [${idsPagina.map((id) => `${id} 0 R`).join(' ')}] /Count ${idsPagina.length} >>\nendobj\n`,
  )
  const corpo = [catalogo, paginasObj, ...objetos]
  const cabeca = latin1('%PDF-1.4\n')
  const offsets: number[] = [0]
  let cursor = cabeca.length
  for (const obj of corpo) {
    offsets.push(cursor)
    cursor += obj.length
  }
  const tamanho = corpo.length + 1
  let xref = `xref\n0 ${tamanho}\n0000000000 65535 f \n`
  for (let i = 1; i < tamanho; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${tamanho} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF`
  return juntar([cabeca, ...corpo, latin1(xref)])
}

export function abrirCurriculoPdf(profissional: Profissional) {
  const bytes = curriculoPdfBytes(profissional)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
