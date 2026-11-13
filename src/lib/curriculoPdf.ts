import { montarCurriculo, type CurriculoDetalhado, type ExtrasCurriculo, type Tom } from './curriculoDetalhado'
import type { Profissional } from './types'

/*
 * Currículo em PDF montado à mão (A4, Helvetica), sem biblioteca: o arquivo nasce no navegador da empresa.
 * O conteúdo vem de montarCurriculo (o mesmo do painel "Ver currículo"), sem contato nem documento pessoal.
 */

type Cor = readonly [number, number, number]
type Fonte = 'F1' | 'F2'

const A4_LARGURA = 595
const A4_ALTURA = 842
const ESQ = 40
const DIR = 555
const LARGURA = DIR - ESQ
/** Nenhuma linha de conteúdo desce abaixo disto: o rodapé fica embaixo. */
const LIMITE = 66

const ESCURO: Cor = [0.067, 0.067, 0.075]
const TEXTO: Cor = [0.13, 0.14, 0.16]
const CINZA: Cor = [0.42, 0.45, 0.5]
const CINZA_CLARO: Cor = [0.7, 0.72, 0.75]
const CLARO_CAPA: Cor = [0.86, 0.87, 0.89]
const LINHA: Cor = [0.88, 0.89, 0.91]
const SUAVE: Cor = [0.955, 0.96, 0.968]
const AMARELO: Cor = [0.976, 0.859, 0]
const AMARELO_SUAVE: Cor = [1, 0.965, 0.78]
const BRANCO: Cor = [1, 1, 1]
const VERDE: Cor = [0.09, 0.58, 0.3]
const LARANJA: Cor = [0.85, 0.47, 0.02]
const VERMELHO: Cor = [0.82, 0.16, 0.16]

const TONS: Record<Tom, { fundo: Cor; texto: Cor }> = {
  ok: { fundo: [0.86, 0.96, 0.89], texto: [0.07, 0.47, 0.24] },
  atencao: { fundo: [1, 0.94, 0.78], texto: [0.6, 0.36, 0] },
  alerta: { fundo: [0.99, 0.89, 0.89], texto: [0.72, 0.12, 0.12] },
  neutro: { fundo: [0.93, 0.94, 0.95], texto: [0.33, 0.36, 0.41] },
}

// ------------------------------------------------------------------ texto em WinAnsi e largura das letras

/** Larguras (milésimos do corpo) da Helvetica e da Helvetica-Bold, do espaço (32) ao til (126). */
function tabela(valores: string) {
  return valores.split(' ').flatMap((item) => {
    const [largura, vezes] = item.split('*')
    return Array.from({ length: Number(vezes ?? 1) }, () => Number(largura))
  })
}

const LARGURA_REGULAR = tabela(
  '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556*10 278 278 584 584 584 556 1015 ' +
    '667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 ' +
    '278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 ' +
    '556 500 722 500 500 500 334 260 334 584',
)

const LARGURA_NEGRITO = tabela(
  '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556*10 333 333 584 584 584 611 975 ' +
    '722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 ' +
    '333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 ' +
    '611 556 778 556 556 500 389 280 389 584',
)

/** Sinais tipográficos que o WinAnsi tem fora do Latin-1. */
const WIN_ANSI: Record<string, number> = {
  '€': 0x80,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
}

const LARGURA_ESPECIAL: Record<number, [number, number]> = {
  0x80: [556, 556],
  0x85: [1000, 1000],
  0x91: [222, 278],
  0x92: [222, 278],
  0x93: [333, 500],
  0x94: [333, 500],
  0x95: [350, 350],
  0x96: [556, 556],
  0x97: [1000, 1000],
  0xa0: [278, 278],
  0xaa: [370, 370],
  0xb0: [400, 400],
  0xb7: [278, 278],
  0xba: [365, 365],
}

function paraWinAnsi(texto: string) {
  let saida = ''
  for (const ch of texto.normalize('NFC')) {
    if (ch === '\t' || ch === '\n' || ch === '\r') {
      saida += ' '
      continue
    }
    const especial = WIN_ANSI[ch]
    if (especial) {
      saida += String.fromCharCode(especial)
      continue
    }
    const codigo = ch.codePointAt(0) ?? 63
    if ((codigo >= 32 && codigo <= 126) || (codigo >= 160 && codigo <= 255)) {
      saida += ch
      continue
    }
    // Fora do WinAnsi (emoji, outros alfabetos): fica a letra sem acento, ou nada.
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (base && /^[ -~]+$/.test(base)) saida += base
  }
  return saida
}

function larguraLetra(codigo: number, fonte: Fonte) {
  const lista = fonte === 'F2' ? LARGURA_NEGRITO : LARGURA_REGULAR
  if (codigo >= 32 && codigo <= 126) return lista[codigo - 32] ?? 556
  const especial = LARGURA_ESPECIAL[codigo]
  if (especial) return especial[fonte === 'F2' ? 1 : 0]
  if (codigo >= 192) {
    const base = String.fromCharCode(codigo).normalize('NFD').charCodeAt(0)
    if (base >= 32 && base <= 126) return lista[base - 32] ?? 556
  }
  return 556
}

function larguraTexto(texto: string, tamanho: number, fonte: Fonte, espaco = 0) {
  const codificado = paraWinAnsi(texto)
  let total = 0
  for (let i = 0; i < codificado.length; i += 1) total += larguraLetra(codificado.charCodeAt(i), fonte)
  return (total * tamanho) / 1000 + espaco * codificado.length
}

/** Quebra um parágrafo em linhas que cabem na largura (palavra maior que a linha é cortada). */
function quebrarLinhas(texto: string, largura: number, tamanho: number, fonte: Fonte) {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (larguraTexto(tentativa, tamanho, fonte) <= largura) {
      atual = tentativa
      continue
    }
    if (atual) linhas.push(atual)
    let resto = palavra
    while (resto.length > 1 && larguraTexto(resto, tamanho, fonte) > largura) {
      let corte = resto.length - 1
      while (corte > 1 && larguraTexto(resto.slice(0, corte), tamanho, fonte) > largura) corte -= 1
      linhas.push(resto.slice(0, corte))
      resto = resto.slice(corte)
    }
    atual = resto
  }
  if (atual) linhas.push(atual)
  return linhas
}

/** Corta com reticências o que não cabe numa linha só. */
function cortar(texto: string, largura: number, tamanho: number, fonte: Fonte) {
  if (larguraTexto(texto, tamanho, fonte) <= largura) return texto
  let fim = texto.length
  while (fim > 1 && larguraTexto(`${texto.slice(0, fim).trimEnd()}…`, tamanho, fonte) > largura) fim -= 1
  return `${texto.slice(0, fim).trimEnd()}…`
}

/** Maior corpo de letra (até `maximo`) em que o texto cabe numa linha. */
function corpoQueCabe(texto: string, largura: number, maximo: number, minimo: number, fonte: Fonte) {
  let tamanho = maximo
  while (tamanho > minimo && larguraTexto(texto, tamanho, fonte) > largura) tamanho -= 0.5
  return tamanho
}

// ------------------------------------------------------------------ desenho de uma página

function n(valor: number) {
  return String(Math.round(valor * 100) / 100)
}

function cor(c: Cor) {
  return `${n(c[0])} ${n(c[1])} ${n(c[2])}`
}

function escapar(texto: string) {
  return texto.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

class Pagina {
  private comandos: string[] = []

  ret(x: number, y: number, w: number, h: number, c: Cor) {
    if (w <= 0 || h <= 0) return
    this.comandos.push(`${cor(c)} rg`, `${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`)
  }

  arredondado(x: number, y: number, w: number, h: number, raio: number, c: Cor) {
    if (w <= 0 || h <= 0) return
    const r = Math.min(raio, w / 2, h / 2)
    const k = r * 0.5523
    this.comandos.push(
      `${cor(c)} rg`,
      `${n(x + r)} ${n(y)} m`,
      `${n(x + w - r)} ${n(y)} l`,
      `${n(x + w - r + k)} ${n(y)} ${n(x + w)} ${n(y + r - k)} ${n(x + w)} ${n(y + r)} c`,
      `${n(x + w)} ${n(y + h - r)} l`,
      `${n(x + w)} ${n(y + h - r + k)} ${n(x + w - r + k)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)} c`,
      `${n(x + r)} ${n(y + h)} l`,
      `${n(x + r - k)} ${n(y + h)} ${n(x)} ${n(y + h - r + k)} ${n(x)} ${n(y + h - r)} c`,
      `${n(x)} ${n(y + r)} l`,
      `${n(x)} ${n(y + r - k)} ${n(x + r - k)} ${n(y)} ${n(x + r)} ${n(y)} c`,
      'f',
    )
  }

  circulo(cx: number, cy: number, r: number, c: Cor) {
    this.arredondado(cx - r, cy - r, r * 2, r * 2, r, c)
  }

  traco(x1: number, y1: number, x2: number, y2: number, c: Cor, espessura: number) {
    this.comandos.push('q', `${cor(c)} RG`, `${n(espessura)} w`, `${n(x1)} ${n(y1)} m`, `${n(x2)} ${n(y2)} l`, 'S', 'Q')
  }

  /** Marca de "sim" desenhada (a Helvetica não tem o caractere). */
  marcaSim(x: number, y: number, s: number, c: Cor) {
    this.comandos.push(
      'q',
      `${cor(c)} RG`,
      `${n(s * 0.2)} w`,
      '1 J 1 j',
      `${n(x)} ${n(y + s * 0.5)} m`,
      `${n(x + s * 0.38)} ${n(y + s * 0.12)} l`,
      `${n(x + s)} ${n(y + s * 0.9)} l`,
      'S',
      'Q',
    )
  }

  marcaNao(x: number, y: number, s: number, c: Cor) {
    this.comandos.push(
      'q',
      `${cor(c)} RG`,
      `${n(s * 0.24)} w`,
      '1 J',
      `${n(x)} ${n(y)} m`,
      `${n(x + s)} ${n(y + s)} l`,
      `${n(x)} ${n(y + s)} m`,
      `${n(x + s)} ${n(y)} l`,
      'S',
      'Q',
    )
  }

  texto(x: number, y: number, valor: string, tamanho: number, fonte: Fonte, c: Cor, espaco = 0) {
    const codificado = paraWinAnsi(valor)
    if (!codificado.trim()) return
    this.comandos.push(
      'BT',
      `${cor(c)} rg`,
      `/${fonte} ${n(tamanho)} Tf`,
      `${n(espaco)} Tc`,
      `1 0 0 1 ${n(x)} ${n(y)} Tm`,
      `(${escapar(codificado)}) Tj`,
      'ET',
    )
  }

  textoDireita(direita: number, y: number, valor: string, tamanho: number, fonte: Fonte, c: Cor) {
    this.texto(direita - larguraTexto(valor, tamanho, fonte), y, valor, tamanho, fonte, c)
  }

  textoCentro(centro: number, y: number, valor: string, tamanho: number, fonte: Fonte, c: Cor) {
    this.texto(centro - larguraTexto(valor, tamanho, fonte) / 2, y, valor, tamanho, fonte, c)
  }

  /** Etiqueta arredondada; `y` é a linha de base do texto ao lado. Devolve a largura. */
  selo(x: number, y: number, valor: string, tom: Tom) {
    const tamanho = 8
    const w = larguraTexto(valor, tamanho, 'F2') + 14
    this.arredondado(x, y - 3.5, w, 13.5, 6.75, TONS[tom].fundo)
    this.texto(x + 7, y, valor, tamanho, 'F2', TONS[tom].texto)
    return w
  }

  conteudo() {
    return this.comandos.join('\n')
  }
}

// ------------------------------------------------------------------ montagem do currículo

class Documento {
  readonly paginas: Pagina[] = []
  private p: Pagina
  private y = 0
  private readonly cv: CurriculoDetalhado

  constructor(cv: CurriculoDetalhado) {
    this.cv = cv
    this.p = new Pagina()
    this.paginas.push(this.p)
    this.capa()
  }

  private novaPagina() {
    this.p = new Pagina()
    this.paginas.push(this.p)
    const p = this.p
    p.ret(0, 790, A4_LARGURA, A4_ALTURA - 790, ESCURO)
    p.ret(0, 790, A4_LARGURA, 3, AMARELO)
    p.texto(ESQ, 814, cortar(this.cv.nome, 360, 12.5, 'F2'), 12.5, 'F2', BRANCO)
    p.texto(ESQ, 800, 'Currículo profissional · continuação', 8.5, 'F1', CINZA_CLARO)
    p.textoDireita(DIR, 808, 'Doca Livre · fazumfreela', 8.5, 'F2', AMARELO)
    this.y = 790 - 34
  }

  /** Troca de página se não couber `altura` acima do rodapé. */
  private garantir(altura: number) {
    if (this.y - altura < LIMITE) this.novaPagina()
  }

  private capa() {
    const { p, cv } = this
    const base = 688
    p.ret(0, base, A4_LARGURA, A4_ALTURA - base, ESCURO)
    p.ret(0, base, A4_LARGURA, 4, AMARELO)
    p.texto(ESQ, 812, 'CURRÍCULO PROFISSIONAL', 8.5, 'F2', AMARELO, 1.2)
    p.textoDireita(DIR, 812, 'Doca Livre · fazumfreela', 8.5, 'F2', AMARELO)

    const x = ESQ + 82
    const largura = DIR - x
    const corpoNome = corpoQueCabe(cv.nome, largura, 22, 16, 'F2')
    const linhasNome = quebrarLinhas(cv.nome, largura, corpoNome, 'F2').slice(0, 2)
    const duasLinhas = linhasNome.length > 1
    p.circulo(ESQ + 31, duasLinhas ? 740 : 746, 31, AMARELO)
    p.textoCentro(ESQ + 31, (duasLinhas ? 740 : 746) - 7.5, cv.iniciais, 21, 'F2', ESCURO)

    let y = duasLinhas ? 776 : 768
    for (const linha of linhasNome) {
      p.texto(x, y, linha, corpoNome, 'F2', BRANCO)
      y -= corpoNome + 4
    }
    y -= 3
    const cargos = cv.cargos.length ? cv.cargos.join(' · ') : 'Cargo não informado'
    p.texto(x, y, cortar(cargos, largura, 11, 'F2'), 11, 'F2', AMARELO)
    y -= 16
    const info = [cv.cidade, cv.idade != null ? `${cv.idade} anos` : '', `Nível ${cv.nivel}`].filter(Boolean).join('  ·  ')
    p.texto(x, y, cortar(info, largura, 10, 'F1'), 10, 'F1', CLARO_CAPA)

    // Destaques
    const gap = 10
    const total = cv.destaques.length
    const w = (LARGURA - gap * (total - 1)) / total
    const topo = base - 14
    const altura = 50
    cv.destaques.forEach((item, indice) => {
      const bx = ESQ + indice * (w + gap)
      p.arredondado(bx, topo - altura, w, altura, 8, SUAVE)
      p.ret(bx, topo - altura + 12, 3, altura - 24, AMARELO)
      p.texto(bx + 13, topo - 17, cortar(item.rotulo, w - 22, 8.5, 'F1'), 8.5, 'F1', CINZA)
      const corpo = corpoQueCabe(item.valor, w - 22, 14, 8.5, 'F2')
      p.texto(bx + 13, topo - 37, cortar(item.valor, w - 22, corpo, 'F2'), corpo, 'F2', TEXTO)
    })
    this.y = topo - altura - 30
  }

  private secao(titulo: string, alturaSeguinte = 40) {
    this.garantir(28 + alturaSeguinte)
    this.y -= 4
    const p = this.p
    p.texto(ESQ, this.y, titulo, 12.5, 'F2', TEXTO)
    p.traco(ESQ + larguraTexto(titulo, 12.5, 'F2') + 10, this.y + 4, DIR, this.y + 4, LINHA, 0.7)
    p.ret(ESQ, this.y - 7, 26, 2.5, AMARELO)
    this.y -= 24
  }

  private subtitulo(titulo: string) {
    this.garantir(36)
    this.p.texto(ESQ, this.y, titulo, 10, 'F2', TEXTO)
    this.y -= 16
  }

  private paragrafo(
    texto: string,
    { tamanho = 10.5, fonte = 'F1', c = TEXTO, x = ESQ, largura = LARGURA }: {
      tamanho?: number
      fonte?: Fonte
      c?: Cor
      x?: number
      largura?: number
    } = {},
  ) {
    const entrelinha = tamanho * 1.45
    const partes = texto
      .split(/\n+/)
      .map((parte) => parte.trim())
      .filter(Boolean)
    partes.forEach((parte, indice) => {
      if (indice) this.y -= entrelinha * 0.4
      for (const linha of quebrarLinhas(parte, largura, tamanho, fonte)) {
        this.garantir(entrelinha)
        this.p.texto(x, this.y, linha, tamanho, fonte, c)
        this.y -= entrelinha
      }
    })
  }

  private linhasDaGrade(itens: { rotulo: string; valor: string }[], colunas: number) {
    const w = (LARGURA - 18 * (colunas - 1)) / colunas
    const linhas: { itens: { rotulo: string; valor: string }[]; valores: string[][]; altura: number }[] = []
    for (let i = 0; i < itens.length; i += colunas) {
      const linha = itens.slice(i, i + colunas)
      const valores = linha.map((item) => quebrarLinhas(item.valor, w, 10.5, 'F2').slice(0, 3))
      linhas.push({ itens: linha, valores, altura: 12 + Math.max(1, ...valores.map((v) => v.length)) * 14 + 6 })
    }
    return linhas
  }

  /** Altura da grade inteira: a seção pede esse espaço para não partir uma grade curta entre duas páginas. */
  private alturaGrade(itens: { rotulo: string; valor: string }[], colunas = 2) {
    return Math.min(260, this.linhasDaGrade(itens, colunas).reduce((soma, linha) => soma + linha.altura, 0))
  }

  private grade(itens: { rotulo: string; valor: string }[], colunas = 2) {
    const gap = 18
    const w = (LARGURA - gap * (colunas - 1)) / colunas
    const linhas = this.linhasDaGrade(itens, colunas)
    linhas.forEach(({ itens: linha, valores, altura }, indice) => {
      this.garantir(altura)
      linha.forEach((item, j) => {
        const x = ESQ + j * (w + gap)
        this.p.texto(x, this.y, item.rotulo, 8.5, 'F1', CINZA)
        valores[j].forEach((valor, k) => this.p.texto(x, this.y - 14 - k * 14, valor, 10.5, 'F2', TEXTO))
      })
      this.y -= altura
      if (indice < linhas.length - 1) this.p.traco(ESQ, this.y + 10, DIR, this.y + 10, LINHA, 0.5)
    })
    this.y -= 4
  }

  private chips(itens: string[], fundo: Cor, c: Cor) {
    const tamanho = 9.5
    const altura = 18
    let x = ESQ
    this.garantir(altura + 4)
    for (const item of itens) {
      const texto = cortar(item, LARGURA - 20, tamanho, 'F1')
      const w = larguraTexto(texto, tamanho, 'F1') + 18
      if (x > ESQ && x + w > DIR) {
        x = ESQ
        this.y -= altura + 7
        this.garantir(altura + 4)
      }
      this.p.arredondado(x, this.y - 5.5, w, altura, 9, fundo)
      this.p.texto(x + 9, this.y, texto, tamanho, 'F1', c)
      x += w + 6
    }
    this.y -= altura + 14
  }

  private resumo() {
    if (!this.cv.resumo) return
    this.secao('Resumo profissional', 30)
    this.paragrafo(this.cv.resumo)
    this.y -= 6
  }

  private experiencias() {
    const lista = this.cv.experiencias
    this.secao('Experiência profissional', lista.length ? 52 : 20)
    if (!lista.length) {
      this.paragrafo('O profissional ainda não descreveu experiências no currículo.', { c: CINZA })
      this.y -= 6
      return
    }
    const xTexto = ESQ + 18
    const larguraItem = DIR - xTexto
    for (const item of lista) {
      const larguraPeriodo = larguraTexto(item.periodo, 9.5, 'F1')
      const cargo = quebrarLinhas(item.cargo, larguraItem - larguraPeriodo - 14, 11.5, 'F2')
      const descricao = item.descricao
        .split(/\n+/)
        .flatMap((parte) => quebrarLinhas(parte, larguraItem, 10, 'F1'))
      const total = cargo.length * 15 + 15 + descricao.length * 14 + 12
      this.garantir(Math.min(total, 84))

      // Linha do tempo: bolinha no cargo e um fio ao longo das linhas seguintes do mesmo trabalho.
      const fio = (altura: number) => this.p.ret(ESQ + 4.4, this.y - 4, 1.2, altura, LINHA)
      this.p.circulo(ESQ + 5, this.y + 3.5, 4.5, AMARELO)
      cargo.forEach((linha, indice) => {
        if (indice) {
          this.garantir(15)
          fio(15)
        }
        this.p.texto(xTexto, this.y, linha, 11.5, 'F2', TEXTO)
        if (!indice) this.p.textoDireita(DIR, this.y, item.periodo, 9.5, 'F1', CINZA)
        this.y -= 15
      })

      this.garantir(15)
      fio(15)
      const espacoSelo = item.atual ? 92 : 0
      const sub = cortar(item.duracao ? `${item.empresa}  ·  ${item.duracao}` : item.empresa, larguraItem - espacoSelo, 10, 'F1')
      this.p.texto(xTexto, this.y, sub, 10, 'F1', CINZA)
      if (item.atual) this.p.selo(xTexto + larguraTexto(sub, 10, 'F1') + 8, this.y, 'Trabalho atual', 'ok')
      this.y -= 15

      for (const linha of descricao) {
        this.garantir(14)
        fio(14)
        this.p.texto(xTexto, this.y, linha, 10, 'F1', TEXTO)
        this.y -= 14
      }
      this.y -= 10
    }
  }

  private certificados() {
    const lista = this.cv.certificados
    this.secao('Certificações e cursos', lista.length ? 52 : 20)
    if (!lista.length) {
      this.paragrafo('Nenhuma certificação registrada no currículo.', { c: CINZA })
      this.y -= 6
      return
    }
    const colunaValidade = ESQ + 250
    const colunaSituacao = ESQ + 355
    const cabecalho = () => {
      this.p.arredondado(ESQ, this.y - 6.5, LARGURA, 20, 5, SUAVE)
      this.p.texto(ESQ + 10, this.y, 'Curso ou certificação', 8.5, 'F2', CINZA)
      this.p.texto(colunaValidade, this.y, 'Validade', 8.5, 'F2', CINZA)
      this.p.texto(colunaSituacao, this.y, 'Situação', 8.5, 'F2', CINZA)
      this.y -= 24
    }
    cabecalho()
    lista.forEach((item, indice) => {
      const nome = quebrarLinhas(item.nome, colunaValidade - ESQ - 22, 10.5, 'F2').slice(0, 2)
      const altura = nome.length * 14 + 10
      const pagina = this.p
      this.garantir(altura)
      if (pagina !== this.p) cabecalho()
      nome.forEach((linha, k) => this.p.texto(ESQ + 10, this.y - k * 14, linha, 10.5, 'F2', TEXTO))
      this.p.texto(colunaValidade, this.y, item.validade, 10, 'F1', TEXTO)
      this.p.selo(colunaSituacao, this.y, cortar(item.situacao, DIR - colunaSituacao - 14, 8, 'F2'), item.tom)
      this.y -= altura
      if (indice < lista.length - 1) this.p.traco(ESQ, this.y + 10, DIR, this.y + 10, LINHA, 0.5)
    })
    this.y -= 2
    this.paragrafo(
      this.cv.certificadosConferidos
        ? 'A situação vem da conferência dos certificados enviados pelo profissional à fazumfreela.'
        : 'Cursos informados pelo profissional no currículo.',
      { tamanho: 8.5, c: CINZA },
    )
    this.y -= 6
  }

  private disponibilidade() {
    const itens = this.cv.disponibilidade
    this.secao('Disponibilidade', Math.ceil(itens.length / 3) * 20)
    const coluna = LARGURA / 3
    for (let i = 0; i < itens.length; i += 3) {
      this.garantir(19)
      itens.slice(i, i + 3).forEach((item, j) => {
        const x = ESQ + j * coluna
        if (item.ok) {
          this.p.circulo(x + 6, this.y + 3.5, 6.5, TONS.ok.fundo)
          this.p.marcaSim(x + 2.6, this.y + 0.4, 7, VERDE)
        } else {
          this.p.circulo(x + 6, this.y + 3.5, 6.5, SUAVE)
          this.p.marcaNao(x + 3.6, this.y + 1.1, 4.8, CINZA_CLARO)
        }
        this.p.texto(x + 18, this.y, cortar(item.rotulo, coluna - 24, 10, 'F1'), 10, 'F1', item.ok ? TEXTO : CINZA_CLARO)
      })
      this.y -= 20
    }
    this.y -= 6
  }

  private analise() {
    const a = this.cv.analise
    if (!a) return
    // A análise é lida de uma vez: se não couber inteira no fim da página, começa na seguinte.
    const estimada =
      (a.vaga ? 20 : 0) +
      36 +
      a.barras.length * 21 +
      (a.checagens.length ? 22 + a.checagens.length * 17 : 0) +
      (a.porque ? 24 + quebrarLinhas(a.porque, LARGURA, 10, 'F1').length * 14.5 : 0) +
      (a.situacao ? 30 : 0) +
      24
    this.secao('Análise para a vaga', Math.min(estimada, 600))
    if (a.vaga) {
      this.paragrafo(`Vaga pesquisada: ${a.vaga}`, { tamanho: 10, c: CINZA })
      this.y -= 4
    }

    this.garantir(34)
    const nota = String(a.nota)
    const larguraNota = larguraTexto(nota, 24, 'F2')
    this.p.texto(ESQ, this.y - 6, nota, 24, 'F2', TEXTO)
    this.p.texto(ESQ + larguraNota + 3, this.y - 6, '/100', 11, 'F1', CINZA)
    this.p.selo(ESQ + larguraNota + larguraTexto('/100', 11, 'F1') + 16, this.y - 3, a.selo, a.tom)
    this.y -= 36

    const xBarra = ESQ + 100
    const larguraBarra = 200
    const xTextoBarra = xBarra + larguraBarra + 16
    for (const barra of a.barras) {
      const textos = quebrarLinhas(barra.texto, DIR - xTextoBarra, 9, 'F1').slice(0, 2)
      const altura = Math.max(1, textos.length) * 12 + 9
      this.garantir(altura)
      this.p.texto(ESQ, this.y, barra.rotulo, 10, 'F1', TEXTO)
      this.p.arredondado(xBarra, this.y + 0.5, larguraBarra, 6, 3, LINHA)
      const parte = barra.nivel === 'alto' ? 1 : barra.nivel === 'medio' ? 0.6 : 0.25
      const corBarra = barra.nivel === 'alto' ? VERDE : barra.nivel === 'medio' ? LARANJA : VERMELHO
      this.p.arredondado(xBarra, this.y + 0.5, larguraBarra * parte, 6, 3, corBarra)
      textos.forEach((linha, k) => this.p.texto(xTextoBarra, this.y - k * 12, linha, 9, 'F1', CINZA))
      this.y -= altura
    }

    if (a.checagens.length) {
      this.y -= 6
      this.subtitulo('Requisitos da vaga')
      for (const item of a.checagens) {
        const texto = `${item.rotulo}${item.obrigatorio ? '' : ' (diferencial)'}${item.ok ? '' : ' - não atende'}`
        const linhas = quebrarLinhas(texto, LARGURA - 20, 10, 'F1')
        this.garantir(linhas.length * 14 + 4)
        if (item.ok) this.p.marcaSim(ESQ + 1, this.y + 0.4, 8, VERDE)
        else this.p.marcaNao(ESQ + 2, this.y + 0.6, 6.5, VERMELHO)
        linhas.forEach((linha, k) => this.p.texto(ESQ + 18, this.y - k * 14, linha, 10, 'F1', item.ok ? TEXTO : VERMELHO))
        this.y -= linhas.length * 14 + 3
      }
    }

    if (a.porque) {
      this.y -= 8
      this.subtitulo('Por que este profissional apareceu')
      this.paragrafo(a.porque, { tamanho: 10 })
    }
    if (a.situacao) {
      this.y -= 4
      this.paragrafo(a.situacao, { tamanho: 10, c: LARANJA })
    }
    this.y -= 4
    this.paragrafo('A análise mostra o encaixe com a vaga. A escolha continua com a empresa tomadora.', {
      tamanho: 8.5,
      c: CINZA,
    })
  }

  montar() {
    const { cv } = this
    this.resumo()
    this.secao('Dados profissionais', this.alturaGrade(cv.dados))
    this.grade(cv.dados)
    this.secao('Histórico na fazumfreela', this.alturaGrade(cv.historico))
    this.grade(cv.historico)
    if (cv.cargos.length) {
      this.secao('Cargos de interesse', 24)
      this.chips(cv.cargos, AMARELO_SUAVE, TEXTO)
    }
    this.experiencias()
    this.certificados()
    if (cv.habilidades.length) {
      this.secao('Habilidades', 24)
      this.chips(cv.habilidades, SUAVE, TEXTO)
    }
    this.disponibilidade()
    this.analise()

    const total = this.paginas.length
    this.paginas.forEach((pagina, indice) => {
      pagina.traco(ESQ, 48, DIR, 48, LINHA, 0.6)
      pagina.texto(ESQ, 34, `Doca Livre fazumfreela  ·  Currículo gerado em ${cv.geradoEm}`, 8, 'F1', CINZA)
      pagina.textoDireita(DIR, 34, `Página ${indice + 1} de ${total}`, 8, 'F1', CINZA)
      pagina.texto(
        ESQ,
        22,
        'Telefone, e-mail, CPF e endereço do profissional ficam protegidos pela fazumfreela (LGPD).',
        7.5,
        'F1',
        CINZA_CLARO,
      )
    })
    return this.paginas
  }
}

// ------------------------------------------------------------------ arquivo PDF

function latin1(texto: string) {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i += 1) {
    const codigo = texto.charCodeAt(i)
    bytes[i] = codigo <= 255 ? codigo : 63
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

/** Texto das propriedades do PDF (título, autor) em UTF-16, aceito por todo leitor. */
function textoUnicode(texto: string) {
  let hex = 'FEFF'
  for (let i = 0; i < texto.length; i += 1) hex += texto.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()
  return `<${hex}>`
}

function dataPdf(data: Date) {
  const d = (v: number) => String(v).padStart(2, '0')
  return `D:${data.getFullYear()}${d(data.getMonth() + 1)}${d(data.getDate())}${d(data.getHours())}${d(data.getMinutes())}${d(data.getSeconds())}`
}

export function curriculoPdfBytes(profissional: Profissional, extras: ExtrasCurriculo = {}) {
  const cv = montarCurriculo(profissional, extras)
  const paginas = new Documento(cv).montar()
  const objetos: Uint8Array[] = []
  let proximoId = 3

  const fluxos = paginas.map((pagina) => {
    const id = proximoId
    proximoId += 1
    const dados = latin1(pagina.conteudo())
    objetos.push(
      juntar([latin1(`${id} 0 obj\n<< /Length ${dados.length} >>\nstream\n`), dados, latin1('\nendstream\nendobj\n')]),
    )
    return id
  })
  const idsPagina = paginas.map(() => {
    const id = proximoId
    proximoId += 1
    return id
  })
  const idFonte = proximoId
  const idFonteNegrito = proximoId + 1
  const idInfo = proximoId + 2

  idsPagina.forEach((id, indice) => {
    objetos.push(
      latin1(
        `${id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LARGURA} ${A4_ALTURA}] /Contents ${fluxos[indice]} 0 R /Resources << /Font << /F1 ${idFonte} 0 R /F2 ${idFonteNegrito} 0 R >> >> >>\nendobj\n`,
      ),
    )
  })
  objetos.push(
    latin1(`${idFonte} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`),
    latin1(
      `${idFonteNegrito} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`,
    ),
    latin1(
      `${idInfo} 0 obj\n<< /Title ${textoUnicode(`Currículo - ${cv.nome}`)} /Author ${textoUnicode('Doca Livre fazumfreela')} /Creator (fazumfreela) /Producer (fazumfreela) /CreationDate (${dataPdf(new Date())}) >>\nendobj\n`,
    ),
  )

  const catalogo = latin1('1 0 obj\n<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>\nendobj\n')
  const paginasObj = latin1(
    `2 0 obj\n<< /Type /Pages /Kids [${idsPagina.map((id) => `${id} 0 R`).join(' ')}] /Count ${idsPagina.length} >>\nendobj\n`,
  )
  const corpo = [catalogo, paginasObj, ...objetos]
  const cabeca = latin1('%PDF-1.4\n%âãÏÓ\n')
  const posicoes: number[] = []
  let cursor = cabeca.length
  for (const obj of corpo) {
    posicoes.push(cursor)
    cursor += obj.length
  }
  // O número de cada objeto é a sua posição + 1 (1 = catálogo, 2 = páginas, depois na ordem acima).
  const ordem = [1, 2, ...fluxos, ...idsPagina, idFonte, idFonteNegrito, idInfo]
  const posicaoDe = new Map(ordem.map((id, indice) => [id, posicoes[indice]]))
  const tamanho = idInfo + 1
  let xref = `xref\n0 ${tamanho}\n0000000000 65535 f \n`
  for (let id = 1; id < tamanho; id += 1) {
    xref += `${String(posicaoDe.get(id) ?? 0).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${tamanho} /Root 1 0 R /Info ${idInfo} 0 R >>\nstartxref\n${cursor}\n%%EOF\n`
  return juntar([cabeca, ...corpo, latin1(xref)])
}

export function nomeArquivoCurriculo(profissional: Profissional) {
  const nome = profissional.nome.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'profissional'
  return `Currículo - ${nome}.pdf`
}

function urlDoPdf(profissional: Profissional, extras?: ExtrasCurriculo) {
  const bytes = curriculoPdfBytes(profissional, extras)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
  return url
}

/** Abre o currículo em PDF numa aba nova. */
export function abrirCurriculoPdf(profissional: Profissional, extras?: ExtrasCurriculo) {
  window.open(urlDoPdf(profissional, extras), '_blank', 'noopener')
}

/** Salva o currículo em PDF com o nome da pessoa. */
export function baixarCurriculoPdf(profissional: Profissional, extras?: ExtrasCurriculo) {
  const link = document.createElement('a')
  link.href = urlDoPdf(profissional, extras)
  link.download = nomeArquivoCurriculo(profissional)
  document.body.appendChild(link)
  link.click()
  link.remove()
}
