// Build legacy: a moderna usa Promise.withResolvers, Map.getOrInsertComputed e Math.sumPrecise sem
// polyfill — em iPhone abaixo do iOS 17.4 e navegadores antigos o PDF não abria.
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { allCargos } from '../data/categories'
import { chamarApi } from './api'
import { emDemo } from './modo'
import { lerArquivoCadastro } from './analisarDocumentoCadastro'
import {
  ESCOLARIDADES,
  curriculoVazio,
  mesAtual,
  nomeCertificado,
  ordenarExperiencias,
  semContato,
  type CurriculoLido,
} from './curriculo'
import { extrairCurriculoLocal } from './extrairCurriculo'
import { textoDocAntigo, textoDocx } from './textoWord'
import type { Experiencia } from './types'

export const ACCEPT_CURRICULO =
  '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export type LeituraCurriculo = {
  lido: CurriculoLido
  arquivoNome: string
  /** Cópia do arquivo para a equipe da fazumfreela. Fica de fora quando o arquivo é grande. */
  copia?: string
  porIa: boolean
}

const LIMITE_ARQUIVO = 8_000_000
const LIMITE_COPIA = 1_000_000

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
} as const

type Tipo = keyof typeof MIME

function tipoDe(file: File): Tipo | null {
  const nome = file.name.toLowerCase()
  if (file.type === MIME.pdf || nome.endsWith('.pdf')) return 'pdf'
  if (file.type === MIME.docx || nome.endsWith('.docx')) return 'docx'
  if (file.type === MIME.doc || nome.endsWith('.doc')) return 'doc'
  return null
}

type ItemPdf = { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean }

async function textoPdf(buffer: ArrayBuffer) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise
  const linhas: string[] = []
  for (let numero = 1; numero <= Math.min(pdf.numPages, 8); numero += 1) {
    const pagina = await pdf.getPage(numero)
    const conteudo = await pagina.getTextContent()
    let linha = ''
    let ultimoY: number | null = null
    let ultimoFim = 0
    for (const bruto of conteudo.items) {
      if (!('str' in bruto)) continue
      const item = bruto as ItemPdf
      const x = item.transform[4]
      const y = item.transform[5]
      const altura = Math.abs(item.transform[3]) || item.height || 10
      const novaLinha = ultimoY !== null && Math.abs(y - ultimoY) > altura * 0.5
      const coluna = ultimoY !== null && x - ultimoFim > altura * 4
      if ((novaLinha || coluna) && linha.trim()) {
        linhas.push(linha)
        linha = ''
      } else if (linha && x - ultimoFim > altura * 0.2 && !linha.endsWith(' ') && !item.str.startsWith(' ')) {
        linha += ' '
      }
      linha += item.str
      ultimoY = y
      ultimoFim = x + item.width
      if (item.hasEOL) {
        if (linha.trim()) linhas.push(linha)
        linha = ''
        ultimoY = null
      }
    }
    if (linha.trim()) linhas.push(linha)
  }
  return linhas.join('\n')
}

function paraDataUrl(buffer: ArrayBuffer, mime: string) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:${mime};base64,${btoa(binario)}`
}

function texto(valor: unknown, max: number) {
  return typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function lista(valor: unknown, max: number, tamanho: number) {
  return Array.isArray(valor) ? valor.map((item) => texto(item, tamanho)).filter(Boolean).slice(0, max) : []
}

function mes(valor: unknown) {
  const m = /^(\d{4})-(\d{2})$/.exec(texto(valor, 7))
  if (!m) return ''
  const v = `${m[1]}-${m[2]}`
  return Number(m[2]) >= 1 && Number(m[2]) <= 12 && v <= mesAtual() ? v : ''
}

function experienciaDe(valor: unknown): Experiencia | null {
  if (!valor || typeof valor !== 'object') return null
  const e = valor as Record<string, unknown>
  const inicio = mes(e.inicio)
  const fim = e.fim === 'atual' ? 'atual' : mes(e.fim) || inicio
  const item = {
    cargo: semContato(texto(e.cargo, 60)),
    empresa: semContato(texto(e.empresa, 80)),
    inicio,
    fim,
    descricao: semContato(texto(e.descricao, 300)),
  }
  return item.cargo || item.empresa ? item : null
}

function normalizarIa(cru: unknown): CurriculoLido {
  const c = (cru && typeof cru === 'object' ? cru : {}) as Record<string, unknown>
  const cargos = new Set(allCargos().map((cargo) => cargo.id))
  const uf = texto(c.estado, 10).toUpperCase()
  const escolaridade = texto(c.escolaridade, 60)
  return {
    ...curriculoVazio(),
    nome: texto(c.nome, 80),
    nascimento: /^\d{4}-\d{2}-\d{2}$/.test(texto(c.nascimento, 10)) ? texto(c.nascimento, 10) : '',
    cidade: texto(c.cidade, 60),
    estado: /^[A-Z]{2}$/.test(uf) ? uf : '',
    resumo: semContato(texto(c.resumo, 600)),
    escolaridade: ESCOLARIDADES.includes(escolaridade) ? escolaridade : '',
    habilidades: lista(c.habilidades, 10, 40).map(semContato).filter(Boolean),
    profissoes: [...new Set(lista(c.profissoes, 6, 40))].filter((id) => cargos.has(id)),
    experiencia: ordenarExperiencias(
      (Array.isArray(c.experiencia) ? c.experiencia : [])
        .slice(0, 8)
        .map(experienciaDe)
        .filter((item): item is Experiencia => Boolean(item)),
    ),
    certificados: [...new Set(lista(c.certificados, 12, 60).map(nomeCertificado))],
    cnhCategoria: /^(ACC|[A-E]{1,5})$/.test(texto(c.cnhCategoria, 5)) ? texto(c.cnhCategoria, 5) : '',
  }
}

async function organizarComIa(corpo: { texto?: string; imagem?: { mime: string; dados: string } }) {
  // Na demonstração fica só a leitura local. No real, só com login (a IA tem cota).
  if (emDemo()) return null
  const r = await chamarApi<{ curriculo?: unknown }>('/api/cadastro/ler-curriculo', {
    ...corpo,
    cargos: allCargos().map((cargo) => ({ id: cargo.id, label: cargo.label })),
  })
  if (!r.ok || !r.curriculo) return null
  return normalizarIa(r.curriculo)
}

function juntar(ia: CurriculoLido, local: CurriculoLido): CurriculoLido {
  const escolher = <K extends keyof CurriculoLido>(campo: K) => {
    const valor = ia[campo]
    const vazio = Array.isArray(valor) ? valor.length === 0 : !valor
    return vazio ? local[campo] : valor
  }
  const temCidade = Boolean(ia.cidade)
  return {
    nome: escolher('nome'),
    telefone: local.telefone,
    email: local.email,
    cpf: local.cpf,
    nascimento: escolher('nascimento'),
    cidade: temCidade ? ia.cidade : local.cidade,
    estado: temCidade ? ia.estado : local.estado,
    resumo: escolher('resumo'),
    escolaridade: escolher('escolaridade'),
    habilidades: escolher('habilidades'),
    profissoes: escolher('profissoes'),
    experiencia: escolher('experiencia'),
    certificados: escolher('certificados'),
    cnhCategoria: escolher('cnhCategoria'),
  }
}

/** Lê o currículo em PDF ou Word e devolve os campos do cadastro para a pessoa conferir. */
export async function lerCurriculo(file: File): Promise<LeituraCurriculo> {
  const tipo = tipoDe(file)
  if (!tipo) throw new Error('Envie o currículo em PDF ou Word (.docx ou .doc).')
  if (file.size > LIMITE_ARQUIVO) throw new Error('O arquivo passou de 8 MB. Envie um arquivo menor.')
  const buffer = await file.arrayBuffer()

  let conteudo = ''
  try {
    if (tipo === 'pdf') conteudo = await textoPdf(buffer.slice(0))
    else if (tipo === 'docx') conteudo = await textoDocx(new Uint8Array(buffer.slice(0)))
    else conteudo = textoDocAntigo(new Uint8Array(buffer.slice(0)))
  } catch (falha) {
    const msg = falha instanceof Error ? falha.message : ''
    if (tipo === 'pdf' && /password/i.test(msg)) throw new Error('O PDF tem senha. Envie uma cópia sem senha.')
    if (tipo !== 'pdf') throw new Error('Não conseguimos abrir este arquivo do Word. Salve como PDF ou .docx e envie de novo.')
  }

  const copia = buffer.byteLength <= LIMITE_COPIA ? paraDataUrl(buffer, MIME[tipo]) : undefined
  const temTexto = conteudo.replace(/\s+/g, '').length >= 60

  if (!temTexto) {
    if (tipo !== 'pdf') {
      throw new Error('Não conseguimos ler o texto deste arquivo. Salve como PDF ou .docx e envie de novo.')
    }
    const foto = await lerArquivoCadastro(file).catch(() => null)
    const ia = foto ? await organizarComIa({ imagem: { mime: foto.mime, dados: foto.dados } }) : null
    if (!ia) {
      throw new Error('Este PDF parece ser uma foto, e a leitura automática não está disponível agora. Preencha os campos à mão.')
    }
    return { lido: ia, arquivoNome: file.name, copia, porIa: true }
  }

  const local = extrairCurriculoLocal(conteudo)
  const ia = await organizarComIa({ texto: semContato(conteudo).slice(0, 40_000) })
  return {
    lido: ia ? juntar(ia, local) : local,
    arquivoNome: file.name,
    copia,
    porIa: Boolean(ia),
  }
}
