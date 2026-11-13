import { cargoLabel } from '../data/categories'
import { rotuloAnos, type CurriculoAnalisado } from './analiseCurriculo'
import { mesesDeExperiencia, nomeCertificado, ordenarExperiencias, semContato, trabalhoAtual } from './curriculo'
import { certificadosDoCurriculo } from './documentos'
import type { Disponibilidade, DocumentoRegistro, DocumentoStatus, Nivel, Profissional } from './types'

/**
 * Currículo completo que a empresa tomadora vê (painel "Ver currículo" e o PDF).
 * Nunca leva telefone, e-mail, CPF, RG, data de nascimento ou endereço: só cidade, idade e o que é profissional.
 */

export type Tom = 'ok' | 'atencao' | 'alerta' | 'neutro'

export type ExtrasCurriculo = {
  /** Documentos que a empresa enxerga: dão a situação de cada certificado (aprovado, em análise...). */
  documentos?: DocumentoRegistro[]
  /** Análise da busca: entra no PDF como "Análise para a vaga". */
  analise?: CurriculoAnalisado
  /** Texto curto da vaga pesquisada (cargo, período, cidade). */
  vaga?: string
  /** Selo mostrado no cartão da busca (ex.: "Encaixe completo"). */
  selo?: string
  distanciaKm?: number
}

export type ExperienciaDetalhada = {
  cargo: string
  empresa: string
  periodo: string
  duracao: string
  atual: boolean
  descricao: string
}

export type CertificadoDetalhado = {
  nome: string
  validade: string
  situacao: string
  tom: Tom
}

export type AnaliseDetalhada = {
  vaga: string
  nota: number
  selo: string
  tom: Tom
  barras: { rotulo: string; texto: string; nivel: 'alto' | 'medio' | 'baixo' }[]
  checagens: { rotulo: string; ok: boolean; obrigatorio: boolean }[]
  faltando: string[]
  porque: string
  situacao: string
}

export type CurriculoDetalhado = {
  nome: string
  iniciais: string
  cargos: string[]
  idade: number | null
  cidade: string
  nivel: string
  destaques: { rotulo: string; valor: string }[]
  resumo: string
  dados: { rotulo: string; valor: string }[]
  experiencias: ExperienciaDetalhada[]
  certificados: CertificadoDetalhado[]
  /** Os certificados têm situação conferida em documento (e não só o que a pessoa escreveu). */
  certificadosConferidos: boolean
  habilidades: string[]
  disponibilidade: { rotulo: string; ok: boolean }[]
  historico: { rotulo: string; valor: string }[]
  analise: AnaliseDetalhada | null
  geradoEm: string
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const NIVEIS: Record<Nivel, string> = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', elite: 'Elite' }

const DISPONIBILIDADE: { key: keyof Disponibilidade; rotulo: string }[] = [
  { key: 'hoje', rotulo: 'Disponível hoje' },
  { key: 'amanha', rotulo: 'Disponível amanhã' },
  { key: 'estaSemana', rotulo: 'Esta semana' },
  { key: 'finaisDeSemana', rotulo: 'Finais de semana' },
  { key: 'noturno', rotulo: 'Turno noturno' },
  { key: 'viagens', rotulo: 'Viagens' },
  { key: 'temporario', rotulo: 'Trabalho temporário' },
  { key: 'efetivo', rotulo: 'Efetivo' },
  { key: 'freelancer', rotulo: 'Freelancer (missões avulsas)' },
]

const SITUACAO_DOC: Record<DocumentoStatus, { texto: string; tom: Tom }> = {
  aprovado: { texto: 'Certificado aprovado', tom: 'ok' },
  em_analise: { texto: 'Certificado em análise', tom: 'atencao' },
  pendente: { texto: 'Certificado não enviado', tom: 'neutro' },
  recusado: { texto: 'Certificado recusado', tom: 'alerta' },
  vencido: { texto: 'Certificado vencido', tom: 'alerta' },
}

export function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : ''
  return `${primeira}${ultima}`.toUpperCase()
}

export function idadeDe(nascimento: string) {
  if (!nascimento) return null
  const nasc = new Date(`${nascimento.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(nasc.getTime())) return null
  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const aniversario = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate())
  if (hoje < aniversario) idade -= 1
  return idade >= 0 && idade < 120 ? idade : null
}

/** "2026-03" vira "mar/2026"; "2026-03-15" vira "15/03/2026". */
export function dataCurta(valor: string) {
  const [ano, mes, dia] = valor.slice(0, 10).split('-')
  const indice = Number(mes) - 1
  if (!ano || indice < 0 || indice > 11) return valor
  if (dia) return `${dia}/${mes}/${ano}`
  return `${MESES[indice]}/${ano}`
}

export function rotuloMeses(meses: number) {
  if (meses < 1) return 'menos de 1 mês'
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  const textoAnos = `${anos} ano${anos === 1 ? '' : 's'}`
  const textoMeses = `${resto} ${resto === 1 ? 'mês' : 'meses'}`
  if (anos && resto) return `${textoAnos} e ${textoMeses}`
  return anos ? textoAnos : textoMeses
}

/**
 * Texto livre (resumo, descrição) sem contato. Tira também o que sobra quando o telefone ou o e-mail sai,
 * como "Contato: ou." ou "Ligue.".
 */
export function textoSemContato(texto: string) {
  return semContato(texto)
    .replace(/\b(?:contatos?|telefones?|tel|celular|whats(?:app)?|zap|e-?mail)[ \t]*:[ \t]*(?:(?:ou|e)[ \t]*)?(?=[.;,]|$)/gim, '')
    .replace(/\b(?:ligue|ligar|chame)(?:[ \t]+(?:no|para))?[ \t]*(?=[.;,]|$)/gim, '')
    .replace(/[ \t]+([.;,])/g, '$1')
    .replace(/([.;,!?])(?:[ \t]*[.;,])+/g, '$1')
    .replace(/^[ \t]*[.;,][ \t]*/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function vencida(validade: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(validade)) return false
  return validade.slice(0, 10) < new Date().toISOString().slice(0, 10)
}

function numero(valor: number, casas = 1) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

/** Mesmo cálculo da análise da busca (soma dos períodos), para o número bater com o cartão. */
function tempoDeExperiencia(profissional: Profissional) {
  if (!profissional.experiencia.length) return 'Sem experiência descrita'
  const meses = profissional.experiencia.reduce((soma, item) => soma + mesesDeExperiencia(item.inicio, item.fim), 0)
  const texto = rotuloAnos(Math.round((meses / 12) * 10) / 10)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function nivelCompatibilidade(texto: string): 'alto' | 'medio' | 'baixo' {
  const t = texto.toLowerCase()
  if (t.includes('não atende') || t.includes('falta') || t.includes('sem ') || t.includes('distante')) return 'baixo'
  if (t.includes('parcial')) return 'medio'
  return 'alto'
}

function experiencias(profissional: Profissional): ExperienciaDetalhada[] {
  return ordenarExperiencias(profissional.experiencia).map((item) => {
    const atual = trabalhoAtual(item.fim)
    const inicio = item.inicio ? dataCurta(item.inicio) : ''
    const fim = atual ? 'atual' : dataCurta(item.fim)
    const periodo = inicio ? `${inicio} a ${fim}` : atual ? 'Trabalho atual' : `até ${fim}`
    const meses = item.inicio ? mesesDeExperiencia(item.inicio, item.fim) : 0
    return {
      cargo: item.cargo.trim() || 'Cargo não informado',
      empresa: item.empresa.trim() || 'Empresa não informada',
      periodo,
      duracao: item.inicio ? rotuloMeses(meses) : '',
      atual,
      descricao: textoSemContato(item.descricao ?? ''),
    }
  })
}

function certificados(profissional: Profissional, documentos?: DocumentoRegistro[]): CertificadoDetalhado[] {
  const conferidos = documentos ? certificadosDoCurriculo(profissional, documentos) : []
  const vistos = new Set<string>()
  const lista: CertificadoDetalhado[] = []
  for (const cert of profissional.certificados) {
    const nome = nomeCertificado(cert.tipo)
    if (!nome || vistos.has(nome.toLowerCase())) continue
    vistos.add(nome.toLowerCase())
    const conferido = conferidos.find((item) => item.curso === nome)
    const validade = conferido?.doc?.validade || cert.validade || ''
    if (conferido) {
      const situacao = SITUACAO_DOC[conferido.status]
      lista.push({ nome, validade: validade ? dataCurta(validade) : 'Sem validade', situacao: situacao.texto, tom: situacao.tom })
      continue
    }
    const expirou = !cert.valido || vencida(validade)
    lista.push({
      nome,
      validade: validade ? dataCurta(validade) : 'Sem validade',
      situacao: expirou ? 'Vencido' : documentos ? 'Certificado não enviado' : 'Informado no currículo',
      tom: expirou ? 'alerta' : 'neutro',
    })
  }
  return lista
}

function analiseDetalhada(extras: ExtrasCurriculo): AnaliseDetalhada | null {
  const analise = extras.analise
  if (!analise) return null
  const bloqueado = analise.situacao === 'bloqueado'
  const barras = [
    ['Requisitos', analise.compatibilidade.requisitos],
    ['Experiência', analise.compatibilidade.experiencia],
    ['Disponibilidade', analise.compatibilidade.disponibilidade],
    ['Localização', analise.compatibilidade.localizacao],
    ['Certificações', analise.compatibilidade.certificacoes],
  ] as const
  return {
    vaga: extras.vaga ?? '',
    nota: analise.score,
    selo:
      extras.selo ??
      (bloqueado ? 'Fora do ciclo' : analise.atendeObrigatorios ? 'Encaixe completo' : 'Falta requisito'),
    tom: bloqueado ? 'alerta' : analise.atendeObrigatorios ? 'ok' : 'atencao',
    barras: barras.map(([rotulo, texto]) => ({ rotulo, texto, nivel: nivelCompatibilidade(texto) })),
    checagens: analise.checagens.map((item) => ({ rotulo: item.rotulo, ok: item.ok, obrigatorio: item.obrigatorio })),
    faltando: analise.checagens.filter((item) => item.obrigatorio && !item.ok).map((item) => item.rotulo),
    porque: analise.porque,
    situacao: analise.situacaoTexto,
  }
}

export function montarCurriculo(profissional: Profissional, extras: ExtrasCurriculo = {}): CurriculoDetalhado {
  const idade = profissional.idade ?? idadeDe(profissional.nascimento)
  const cidade = [profissional.endereco.cidade, profissional.endereco.estado].filter(Boolean).join('/')
  const nivel = NIVEIS[profissional.nivel] ?? 'Bronze'
  const tempo = tempoDeExperiencia(profissional)
  const certs = certificados(profissional, extras.documentos)
  const aprovados = certs.filter((item) => item.tom === 'ok').length
  const distancia = extras.distanciaKm ?? extras.analise?.distanciaKm
  const nota = profissional.avaliacaoMedia > 0 ? `${numero(profissional.avaliacaoMedia)} de 5` : 'Sem notas ainda'

  const cnh = profissional.cnhCategoria?.trim()
  let cnhTexto = 'Não informada'
  if (cnh) {
    const validade = profissional.cnhValidade
    cnhTexto = `Categoria ${cnh}`
    if (validade) cnhTexto += vencida(validade) ? ` (vencida em ${dataCurta(validade)})` : ` (válida até ${dataCurta(validade)})`
  }

  const dados: { rotulo: string; valor: string }[] = [
    { rotulo: 'Cidade', valor: cidade || 'Não informada' },
    { rotulo: 'Idade', valor: idade != null ? `${idade} anos` : 'Não informada' },
    { rotulo: 'Atende até', valor: `${profissional.raioKm} km de onde mora` },
  ]
  if (distancia != null && Number.isFinite(distancia)) {
    dados.push({
      rotulo: 'Distância até o local',
      valor: distancia < 1 ? 'Menos de 1 km' : `${numero(distancia, distancia < 10 ? 1 : 0)} km`,
    })
  }
  dados.push(
    { rotulo: 'Escolaridade', valor: profissional.escolaridade || 'Não informada' },
    { rotulo: 'CNH', valor: cnhTexto },
    { rotulo: 'Experiência total', valor: tempo },
    { rotulo: 'Nível na fazumfreela', valor: nivel },
  )

  const faltas = profissional.faltas ?? 0
  const resposta = profissional.tempoRespostaMin ?? 0
  const historico = [
    { rotulo: 'Avaliação média das empresas', valor: nota },
    { rotulo: 'Comparecimento', valor: `${profissional.taxaComparecimento}% dos trabalhos` },
    { rotulo: 'Faltas registradas', valor: faltas ? `${faltas} falta${faltas === 1 ? '' : 's'}` : 'Nenhuma' },
    {
      rotulo: 'Tempo médio de resposta',
      valor: resposta >= 60 ? `Cerca de ${numero(resposta / 60)} h` : `Cerca de ${Math.max(1, Math.round(resposta))} min`,
    },
  ]

  const destaques = [
    { rotulo: 'Experiência', valor: tempo === 'Sem experiência descrita' ? 'Não descrita' : tempo },
    { rotulo: 'Avaliação', valor: profissional.avaliacaoMedia > 0 ? `${numero(profissional.avaliacaoMedia)} / 5` : 'Sem notas' },
    { rotulo: 'Comparecimento', valor: `${profissional.taxaComparecimento}%` },
    extras.analise
      ? { rotulo: 'Encaixe na vaga', valor: `${extras.analise.score}/100` }
      : {
          rotulo: extras.documentos ? 'Certificados aprovados' : 'Certificações',
          valor: extras.documentos ? `${aprovados} de ${certs.length}` : String(certs.length),
        },
  ]

  return {
    nome: profissional.nome.trim() || 'Profissional',
    iniciais: iniciaisDe(profissional.nome) || '?',
    cargos: profissional.profissoes.map(cargoLabel),
    idade,
    cidade,
    nivel,
    destaques,
    resumo: textoSemContato(profissional.resumo ?? ''),
    dados,
    experiencias: experiencias(profissional),
    certificados: certs,
    certificadosConferidos: Boolean(extras.documentos),
    habilidades: (profissional.habilidades ?? []).map((item) => item.trim()).filter(Boolean),
    disponibilidade: DISPONIBILIDADE.map((item) => ({ rotulo: item.rotulo, ok: Boolean(profissional.disponibilidade?.[item.key]) })),
    historico,
    analise: analiseDetalhada(extras),
    geradoEm: new Date().toLocaleDateString('pt-BR'),
  }
}
