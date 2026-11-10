import { cargoLabel } from '../data/categories'
import { mesesDeExperiencia } from './curriculo'
import {
  certificadosDoCurriculo,
  checklistProfissional,
  daysUntil,
  effectiveStatus,
  resumoDocumental,
} from './documentos'
import { avaliarPessoaModalidade, type Modalidade, type SituacaoPessoa } from './modalidadeContratacao'
import type { Candidatura, Demanda, DocumentoRegistro, Empresa, Profissional } from './types'

export const REQUISITOS_BUSCA = [
  'CNH',
  'EAR',
  'MOPP',
  'NR11',
  'NR35',
  'NR10',
  'NR20',
  'Munck',
  'Ponte Rolante',
  'GR',
] as const

/** Opções e seleção inicial de cada cargo. A lista muda junto com o tipo. */
const REQUISITOS_POR_CARGO: Record<string, { opcoes: string[]; padrao: string[] }> = {
  motorista_cnh_b: { opcoes: ['CNH', 'EAR'], padrao: ['CNH'] },
  motorista_vuc: { opcoes: ['CNH', 'EAR'], padrao: ['CNH'] },
  motorista_toco: { opcoes: ['CNH', 'EAR', 'MOPP'], padrao: ['CNH'] },
  motorista_truck: { opcoes: ['CNH', 'EAR', 'MOPP', 'GR'], padrao: ['CNH', 'GR'] },
  carreteiro: { opcoes: ['CNH', 'EAR', 'MOPP', 'GR'], padrao: ['CNH', 'GR'] },
  bitrem: { opcoes: ['CNH', 'EAR', 'MOPP', 'GR'], padrao: ['CNH', 'GR'] },
  rodotrem: { opcoes: ['CNH', 'EAR', 'MOPP', 'GR'], padrao: ['CNH', 'GR'] },
  mopp: { opcoes: ['CNH', 'EAR', 'MOPP', 'GR'], padrao: ['CNH', 'MOPP'] },
  munck: { opcoes: ['CNH', 'Munck', 'NR11', 'NR35'], padrao: ['CNH', 'Munck'] },
  auxiliar_logistica: { opcoes: ['Experiência em armazém', 'Turno noturno'], padrao: ['Experiência em armazém'] },
  conferente: { opcoes: ['Experiência em conferência', 'Turno noturno'], padrao: ['Experiência em conferência'] },
  separador: { opcoes: ['Experiência em separação', 'Turno noturno'], padrao: ['Experiência em separação'] },
  estoquista: { opcoes: ['Experiência em estoque', 'Turno noturno'], padrao: ['Experiência em estoque'] },
  expedidor: { opcoes: ['Experiência em expedição', 'Turno noturno'], padrao: ['Experiência em expedição'] },
  recebimento: { opcoes: ['Experiência em recebimento', 'Turno noturno'], padrao: ['Experiência em recebimento'] },
  inventarista: { opcoes: ['Experiência em inventário', 'Experiência em estoque'], padrao: ['Experiência em inventário'] },
  empilhadeira: { opcoes: ['NR11', 'NR35'], padrao: ['NR11'] },
  paleteira: { opcoes: ['NR11'], padrao: ['NR11'] },
  ponte_rolante: { opcoes: ['Ponte Rolante', 'NR11', 'NR35'], padrao: ['Ponte Rolante'] },
  guindaste: { opcoes: ['NR11', 'NR35', 'CNH'], padrao: ['NR11'] },
  reach_stacker: { opcoes: ['NR11', 'NR35'], padrao: ['NR11'] },
  ajudante_carga: { opcoes: ['Experiência em carga e descarga', 'Turno noturno'], padrao: ['Experiência em carga e descarga'] },
  embalador: { opcoes: ['Experiência em embalagem'], padrao: ['Experiência em embalagem'] },
  mecanico_diesel: { opcoes: ['Experiência em diesel', 'NR12'], padrao: ['Experiência em diesel'] },
  eletricista: { opcoes: ['NR10', 'Experiência em elétrica'], padrao: ['NR10'] },
  soldador: { opcoes: ['Experiência em solda', 'NR18'], padrao: ['Experiência em solda'] },
  borracheiro: { opcoes: ['Experiência em pneus'], padrao: ['Experiência em pneus'] },
  lavador_frota: { opcoes: ['Experiência em lavagem de frota'], padrao: ['Experiência em lavagem de frota'] },
  analista_transporte: {
    opcoes: [
      'CNH',
      'EAR',
      'MOPP',
      'Experiência em transporte',
      'Disponibilidade no período',
      'TMS',
      'Excel',
      'Roteirização',
    ],
    padrao: ['Experiência em transporte', 'Disponibilidade no período'],
  },
  torre_controle: { opcoes: ['Experiência em torre de controle', 'TMS'], padrao: ['Experiência em torre de controle'] },
  monitor_frota: { opcoes: ['Experiência em monitoramento de frota', 'CNH'], padrao: ['Experiência em monitoramento de frota'] },
  controlador_patio: { opcoes: ['Experiência em pátio', 'NR11'], padrao: ['Experiência em pátio'] },
}

const CHAVES_REQUISITO: Record<string, string[]> = {
  'Experiência em armazém': ['armazem', 'logistica', 'estoque'],
  'Experiência em conferência': ['conferenc', 'conferente'],
  'Experiência em separação': ['separac', 'separador', 'picker'],
  'Experiência em estoque': ['estoque', 'estoquista'],
  'Experiência em expedição': ['expedic', 'expedidor'],
  'Experiência em recebimento': ['recebimento'],
  'Experiência em inventário': ['inventar'],
  'Experiência em carga e descarga': ['carga', 'descarga', 'ajudante'],
  'Experiência em embalagem': ['embalag', 'embalador'],
  'Experiência em diesel': ['diesel', 'mecanico'],
  'Experiência em elétrica': ['eletric'],
  'Experiência em solda': ['solda', 'soldador'],
  'Experiência em pneus': ['pneu', 'borrache'],
  'Experiência em lavagem de frota': ['lavagem', 'lavador', 'frota'],
  'Experiência em transporte': ['transporte', 'frota', 'rota'],
  Roteirização: ['roteir', 'rota'],
  'Disponibilidade no período': [],
  TMS: ['tms'],
  Excel: ['excel', 'planilha'],
  'Experiência em torre de controle': ['torre', 'controle'],
  'Experiência em monitoramento de frota': ['monitor', 'frota'],
  'Experiência em pátio': ['patio', 'patío'],
  NR12: ['nr12', 'nr-12'],
  NR18: ['nr18', 'nr-18'],
}

export function requisitosDoCargo(cargoId: string) {
  return REQUISITOS_POR_CARGO[cargoId] ?? { opcoes: [...REQUISITOS_BUSCA], padrao: [] }
}

const DOC_DO_REQUISITO: Record<string, string> = {
  CNH: 'cnh',
  EAR: 'cnh',
  MOPP: 'mopp',
  NR11: 'nr11',
  NR35: 'nr35',
  NR10: 'nr10',
  NR20: 'nr20',
  Munck: 'munck',
  'Ponte Rolante': 'ponte_rolante',
  GR: 'aptidao_gr',
}

export type PedidoContratacao = {
  cargoId: string
  requisitos: string[]
  diferenciais: string[]
  inicio: string
  fim: string
  cidade: string
  estado?: string
  raioKm?: number | null
  origem?: { lat: number; lng: number }
  observacoes: string
  modalidade: Modalidade
  quantidade: number
  horaInicio: string
  horaFim: string
  motivo: string
  atividades: string
  remuneracao: string
  beneficios: string
}

export type ChecagemRequisito = {
  rotulo: string
  ok: boolean
  obrigatorio: boolean
}

export type CurriculoAnalisado = {
  profissional: Profissional
  score: number
  leitura: string
  aderencias: string[]
  falhas: string[]
  situacao: SituacaoPessoa
  situacaoTexto: string
  diasPedido: number
  mesmaCidade: boolean
  distanciaKm: number
  checagens: ChecagemRequisito[]
  atendeObrigatorios: boolean
  anosExperiencia: number | null
  porque: string
  compatibilidade: {
    requisitos: string
    experiencia: string
    disponibilidade: string
    localizacao: string
    certificacoes: string
  }
}

export type BuscaMissao = {
  analisados: number
  pessoas: CurriculoAnalisado[]
}

/**
 * completa: cargo, requisitos e certificado aprovado de todos os cursos do currículo.
 * basica: atividades da vaga e pelo menos um certificado aprovado.
 */
export type ModoBusca = 'completa' | 'basica'

const STOP = new Set([
  'para',
  'com',
  'uma',
  'dos',
  'das',
  'que',
  'nao',
  'não',
  'por',
  'como',
  'mais',
  'este',
  'esta',
  'essa',
  'pelo',
  'pela',
  'nos',
  'nas',
  'sem',
  'sob',
  'entre',
  'depois',
  'antes',
])

function semAcento(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function diasInclusivos(inicio: string, fim: string) {
  const a = new Date(`${inicio}T12:00:00`)
  const b = new Date(`${fim}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function certificadoValido(profissional: Profissional, tipo: string) {
  return profissional.certificados.some((c) => {
    if (semAcento(c.tipo) !== semAcento(tipo) || !c.valido) return false
    const dias = daysUntil(c.validade)
    return dias === null || dias >= 0
  })
}

function documentoAprovado(documentos: DocumentoRegistro[], profissionalId: string, tipoId: string, ear = false) {
  const doc = documentos.find(
    (d) => d.donoTipo === 'profissional' && d.donoId === profissionalId && d.tipoId === tipoId,
  )
  if (!doc || effectiveStatus(doc) !== 'aprovado') return false
  if (ear && semAcento(doc.meta?.ear ?? '') !== 'sim') return false
  return true
}

function textoCurriculo(profissional: Profissional) {
  return semAcento(
    [
      profissional.profissoes.map(cargoLabel).join(' '),
      profissional.experiencia.map((e) => `${e.cargo} ${e.empresa} ${e.descricao}`).join(' '),
      profissional.certificados.map((c) => c.tipo).join(' '),
      profissional.resumo ?? '',
      (profissional.habilidades ?? []).join(' '),
    ].join(' '),
  )
}

function requisitoAtendido(
  profissional: Profissional,
  documentos: DocumentoRegistro[],
  requisito: string,
) {
  if (requisito === 'Turno noturno') return profissional.disponibilidade.noturno
  if (requisito === 'Disponibilidade no período') {
    const d = profissional.disponibilidade
    return d.temporario || d.hoje || d.amanha || d.estaSemana || d.noturno || d.finaisDeSemana
  }
  const chaves = CHAVES_REQUISITO[requisito]
  if (chaves) {
    const texto = textoCurriculo(profissional)
    if (chaves.some((chave) => texto.includes(semAcento(chave)))) return true
  }
  if (requisito === 'CNH') {
    const dias = daysUntil(profissional.cnhValidade)
    const cnhVigente = Boolean(profissional.cnhCategoria) && (dias === null || dias >= 0)
    return cnhVigente || documentoAprovado(documentos, profissional.id, 'cnh')
  }
  if (requisito === 'EAR') return documentoAprovado(documentos, profissional.id, 'cnh', true)
  const tipoDoc = DOC_DO_REQUISITO[requisito]
  return (
    certificadoValido(profissional, requisito) ||
    (tipoDoc ? documentoAprovado(documentos, profissional.id, tipoDoc) : false)
  )
}

/**
 * Missões da pessoa com a empresa que contam para o ciclo temporário. `ignorarDemandaId` é a vaga
 * que está sendo analisada: quem já aceitou o convite DESTA vaga não pode contar contra si mesmo
 * (antes caía em "Fora do ciclo" por "sobreposição" com a própria vaga e sumia "Gerar contrato").
 */
function contratosNaEmpresa(
  profissionalId: string,
  empresaId: string,
  demandas: Demanda[],
  candidaturas: Candidatura[],
  ignorarDemandaId?: string | null,
) {
  return candidaturas
    .filter(
      (c) =>
        c.profissionalId === profissionalId &&
        c.demandaId !== ignorarDemandaId &&
        (c.status === 'aceita' || c.status === 'confirmada'),
    )
    .map((c) => {
      const d = demandas.find((item) => item.id === c.demandaId && item.empresaId === empresaId)
      if (!d || d.status === 'cancelada') return undefined
      // Missão encerrada só conta para quem foi de fato contratado.
      if (d.status === 'finalizada' && c.status !== 'confirmada') return undefined
      return d
    })
    .filter((d): d is Demanda => Boolean(d))
}

function avaliarNaModalidade(
  profissionalId: string,
  empresa: Empresa,
  pedido: PedidoContratacao,
  demandas: Demanda[],
  candidaturas: Candidatura[],
  demandaAtualId?: string | null,
) {
  // Período inteiro de cada missão (data..dataFim). Antes só a data de início entrava na conta.
  const periodos = contratosNaEmpresa(profissionalId, empresa.id, demandas, candidaturas, demandaAtualId).map(
    (d) => ({ inicio: d.data, fim: d.dataFim || d.data }),
  )
  return avaliarPessoaModalidade({
    modalidade: pedido.modalidade,
    inicio: pedido.inicio,
    fim: pedido.fim,
    periodosAnteriores: periodos,
  })
}

function anosExperiencia(profissional: Profissional) {
  if (!profissional.experiencia.length) return null
  const meses = profissional.experiencia.reduce((soma, item) => soma + mesesDeExperiencia(item.inicio, item.fim), 0)
  return Math.round((meses / 12) * 10) / 10
}

export function rotuloAnos(anos: number | null) {
  if (anos === null) return 'sem experiência descrita'
  const totalMeses = Math.round(anos * 12)
  const anosCheios = Math.floor(totalMeses / 12)
  const meses = totalMeses % 12
  if (anosCheios && meses) return `${anosCheios} ano${anosCheios === 1 ? '' : 's'} e ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  if (anosCheios) return `${anosCheios} ano${anosCheios === 1 ? '' : 's'}`
  return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
}

function formatarData(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function palavras(texto: string) {
  return semAcento(texto)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
}

type FiltroLocal = {
  cidade: string
  estado?: string
  raioKm?: number | null
  origem: { lat: number; lng: number }
  cidadeEmpresa: string
}

/** Nulo quando a pessoa fica fora do estado ou do raio pedido. */
function localDaPessoa(profissional: Profissional, filtro: FiltroLocal) {
  const estadoPedido = (filtro.estado ?? '').trim().toUpperCase()
  if (estadoPedido && profissional.endereco.estado.toUpperCase() !== estadoPedido) return null
  const cidadePedida = semAcento(filtro.cidade.trim()) || semAcento(filtro.cidadeEmpresa)
  const mesmaCidade = semAcento(profissional.endereco.cidade) === cidadePedida
  const distancia = haversineKm(filtro.origem, profissional.endereco)
  if (filtro.raioKm != null && filtro.raioKm > 0 && !mesmaCidade && distancia > filtro.raioKm) return null
  return { mesmaCidade, distancia }
}

export function analisarCurriculos(params: {
  pedido: PedidoContratacao
  empresa: Empresa
  profissionais: Profissional[]
  documentos: DocumentoRegistro[]
  demandas: Demanda[]
  candidaturas: Candidatura[]
  /** Vaga já criada para este pedido (convites enviados). Fica fora da conta do ciclo temporário. */
  demandaAtualId?: string | null
}): BuscaMissao {
  const { pedido, empresa, profissionais, documentos, demandas, candidaturas, demandaAtualId } = params
  const label = cargoLabel(pedido.cargoId)
  const diasPedido = diasInclusivos(pedido.inicio, pedido.fim)
  const chavesObs = palavras(pedido.observacoes)
  const filtroLocal: FiltroLocal = {
    cidade: pedido.cidade,
    estado: pedido.estado,
    raioKm: pedido.raioKm,
    origem: pedido.origem ?? empresa.endereco,
    cidadeEmpresa: empresa.endereco.cidade,
  }
  const limitePerto = pedido.raioKm != null && pedido.raioKm > 0 ? pedido.raioKm : 40

  const lista: CurriculoAnalisado[] = []
  let analisados = 0

  for (const profissional of profissionais) {
    if (profissional.status !== 'aprovado') continue
    if (empresa.bloqueados.includes(profissional.id)) continue
    const local = localDaPessoa(profissional, filtroLocal)
    if (!local) continue
    const { mesmaCidade, distancia } = local

    analisados += 1

    const aderencias: string[] = []
    const falhas: string[] = []
    let score = 0

    const temCargo = profissional.profissoes.includes(pedido.cargoId)
    if (temCargo) {
      score += 35
      aderencias.push(`Currículo com o cargo ${label}.`)
    } else {
      falhas.push(`Não cadastrou ${label} como profissão.`)
    }

    const reqs = pedido.requisitos
    const diferenciais = pedido.diferenciais ?? []
    const okReqs: string[] = []
    const faltaReqs: string[] = []
    const checagens: ChecagemRequisito[] = [
      { rotulo: label, ok: temCargo, obrigatorio: true },
    ]
    for (const req of reqs) {
      const ok = requisitoAtendido(profissional, documentos, req)
      checagens.push({ rotulo: req, ok, obrigatorio: true })
      if (ok) okReqs.push(req)
      else faltaReqs.push(req)
    }
    const okDifs: string[] = []
    for (const req of diferenciais) {
      const ok = requisitoAtendido(profissional, documentos, req)
      checagens.push({ rotulo: req, ok, obrigatorio: false })
      if (ok) okDifs.push(req)
    }
    const cursos = certificadosDoCurriculo(profissional, documentos)
    const cursosOk = cursos.filter((c) => c.ok).map((c) => c.curso)
    const cursosFalta = cursos.filter((c) => !c.ok).map((c) => c.curso)
    const certificadosOk = cursos.length > 0 && cursosFalta.length === 0
    checagens.push({
      rotulo: cursos.length ? `Certificados do currículo ${cursosOk.length}/${cursos.length}` : 'Certificado de curso',
      ok: certificadosOk,
      obrigatorio: true,
    })
    if (certificadosOk) aderencias.push(`Certificado aprovado de todos os cursos do currículo: ${cursosOk.join(', ')}.`)
    else if (cursos.length) falhas.push(`Falta o certificado aprovado de: ${cursosFalta.join(', ')}.`)
    else falhas.push('O currículo não tem curso com certificado.')

    const obrigatoriosOk = temCargo && faltaReqs.length === 0 && certificadosOk
    if (reqs.length === 0) score += temCargo ? 30 : 0
    else score += Math.round((okReqs.length / reqs.length) * 30)
    if (okDifs.length) score += Math.min(10, okDifs.length * 3)
    if (okReqs.length) aderencias.push(`Requisitos obrigatórios atendidos: ${okReqs.join(', ')}.`)
    if (faltaReqs.length) falhas.push(`Não atende requisito obrigatório: ${faltaReqs.join(', ')}.`)
    if (okDifs.length) aderencias.push(`Diferenciais encontrados: ${okDifs.join(', ')}.`)

    const expTexto = profissional.experiencia
      .map((e) => `${e.cargo} ${e.empresa} ${e.descricao}`)
      .join(' ')
    const baseTexto = semAcento(
      `${expTexto} ${profissional.profissoes.map(cargoLabel).join(' ')} ${profissional.resumo ?? ''} ${(profissional.habilidades ?? []).join(' ')}`,
    )
    const acertosObs = chavesObs.filter((w) => baseTexto.includes(w))
    const expRelacionada = profissional.experiencia.find((e) =>
      semAcento(`${e.cargo} ${e.descricao}`).includes(semAcento(label).slice(0, 6)),
    )
    if (expRelacionada || acertosObs.length) {
      score += Math.min(15, 8 + acertosObs.length * 3)
      if (expRelacionada) {
        aderencias.push(
          `Experiência: ${expRelacionada.cargo} em ${expRelacionada.empresa} (${expRelacionada.inicio} a ${expRelacionada.fim}).`,
        )
      }
      if (acertosObs.length) aderencias.push(`As observações batem com o currículo: ${acertosObs.join(', ')}.`)
    } else if (profissional.experiencia[0]) {
      const e = profissional.experiencia[0]
      aderencias.push(`Última experiência: ${e.cargo} em ${e.empresa}.`)
    } else {
      falhas.push('Currículo sem experiência descrita.')
    }

    if (mesmaCidade) {
      score += 10
      aderencias.push(`Mora em ${profissional.endereco.cidade}/${profissional.endereco.estado}, a cidade pedida.`)
    } else if (distancia <= limitePerto) {
      score += 6
      aderencias.push(`Mora em ${profissional.endereco.cidade}/${profissional.endereco.estado}, a cerca de ${Math.round(distancia)} km.`)
    } else {
      falhas.push(`Mora em ${profissional.endereco.cidade}/${profissional.endereco.estado}, a cerca de ${Math.round(distancia)} km.`)
    }

    const resumoDocs = resumoDocumental(
      checklistProfissional(profissional, documentos, pedido.requisitos),
    )
    score += Math.round((resumoDocs.pct / 100) * 10)
    if (resumoDocs.completo) aderencias.push('Documentação obrigatória completa e válida.')
    else falhas.push(`Documentação em ${resumoDocs.pct}% (${resumoDocs.ok} de ${resumoDocs.total} aprovados).`)

    if (!temCargo) score = Math.min(score, 42)

    const relevante = temCargo || okReqs.length > 0 || okDifs.length > 0
    if (!relevante) continue

    const seq = avaliarNaModalidade(profissional.id, empresa, pedido, demandas, candidaturas, demandaAtualId)
    const anos = anosExperiencia(profissional)
    const disp = profissional.disponibilidade
    const disponivel =
      disp.temporario || disp.hoje || disp.amanha || disp.estaSemana || disp.noturno || disp.finaisDeSemana
    const certsPedidas = [...reqs, ...diferenciais].filter((req) => DOC_DO_REQUISITO[req] || req === 'CNH' || req === 'EAR')
    const certsOk = certsPedidas.filter((req) => requisitoAtendido(profissional, documentos, req))
    const compatibilidade = {
      requisitos: obrigatoriosOk
        ? `${checagens.filter((c) => c.obrigatorio && c.ok).length}/${checagens.filter((c) => c.obrigatorio).length} atendidos`
        : 'Não atende requisito obrigatório',
      experiencia: expRelacionada || acertosObs.length ? 'Alta correspondência' : profissional.experiencia.length ? 'Correspondência parcial' : 'Sem experiência descrita',
      disponibilidade: disponivel ? 'Compatível' : 'Sem disponibilidade marcada',
      localizacao: mesmaCidade || distancia <= limitePerto ? 'Compatível' : 'Distante da operação',
      certificacoes: !cursos.length
        ? 'Sem certificado de curso'
        : cursosFalta.length
          ? `Falta certificado: ${cursosFalta.join(', ')}`
          : certsOk.length === certsPedidas.length
            ? 'Todos os cursos comprovados'
            : 'Falta certificação',
    }
    const cursosSemRequisito = cursosFalta.filter((curso) => !faltaReqs.includes(curso))
    const faltando = [
      ...(temCargo ? [] : [label]),
      ...faltaReqs,
      ...(certificadosOk
        ? []
        : !cursos.length
          ? ['certificado de curso no currículo']
          : cursosSemRequisito.length
            ? [`certificado aprovado de ${cursosSemRequisito.join(', ')}`]
            : []),
    ]
    const porque = obrigatoriosOk
      ? `Possui ${rotuloAnos(anos)} de experiência, ${okReqs.length ? okReqs.join(', ') : label}, certificado aprovado de ${cursosOk.join(', ')} e ${disponivel ? 'disponibilidade no período solicitado' : 'cadastro sem disponibilidade marcada'}. A análise identifica o encaixe. A escolha continua com a empresa tomadora.`
      : `Não atende requisito obrigatório: ${faltando.join(', ')}.`
    const leitura = [
      porque,
      expRelacionada
        ? `No currículo: ${expRelacionada.cargo} na ${expRelacionada.empresa}, ${expRelacionada.descricao}.`
        : '',
      `Missão temporária de ${diasPedido} dia${diasPedido === 1 ? '' : 's'} (${formatarData(pedido.inicio)} a ${formatarData(pedido.fim)}), das ${pedido.horaInicio} às ${pedido.horaFim}.`,
      seq.texto,
    ]
      .filter(Boolean)
      .join(' ')

    lista.push({
      profissional,
      score: Math.max(0, Math.min(100, score)),
      leitura,
      aderencias,
      falhas,
      situacao: seq.situacao,
      situacaoTexto: seq.texto,
      diasPedido,
      mesmaCidade,
      distanciaKm: Math.round(distancia * 10) / 10,
      checagens,
      atendeObrigatorios: obrigatoriosOk,
      anosExperiencia: anos,
      porque,
      compatibilidade,
    })
  }

  lista.sort((a, b) => {
    if (a.situacao === 'bloqueado' && b.situacao !== 'bloqueado') return 1
    if (b.situacao === 'bloqueado' && a.situacao !== 'bloqueado') return -1
    if (a.atendeObrigatorios !== b.atendeObrigatorios) return a.atendeObrigatorios ? -1 : 1
    return b.score - a.score
  })

  return { analisados, pessoas: lista }
}

/** Palavras comuns em qualquer descrição de vaga. Não ajudam a separar currículos. */
const GENERICAS = new Set([
  'atividade',
  'atividades',
  'trabalho',
  'trabalhar',
  'trabalhador',
  'colaborador',
  'profissional',
  'realizar',
  'fazer',
  'empresa',
  'missao',
  'vaga',
  'sera',
  'serao',
  'durante',
  'local',
  'operacao',
  'operacoes',
  'servico',
  'servicos',
  'funcao',
  'cargo',
  'precisa',
  'precisamos',
  'necessario',
  'necessita',
  'experiencia',
  'anos',
  'dias',
  'horas',
  'turno',
  'todos',
  'todas',
  'cada',
  'outros',
  'outras',
  'sobre',
  'quando',
  'onde',
  'tambem',
  'muito',
  'deve',
  'devera',
  'estar',
  'fara',
  'irao',
  'geral',
  'gerais',
])

type Termo = { palavra: string; raiz: string }

function raiz(palavra: string) {
  const w = palavra.length > 4 ? palavra.replace(/s$/, '') : palavra
  return w.length <= 5 ? w : w.slice(0, Math.max(5, w.length - 3))
}

/** Palavras das atividades que entram na comparação com o currículo. */
export function termosDasAtividades(texto: string): Termo[] {
  const vistos = new Set<string>()
  const termos: Termo[] = []
  for (const original of texto.split(/[^\p{L}\p{N}]+/u)) {
    const w = semAcento(original)
    const sigla = /^[A-Z]{3}$/.test(original)
    if ((w.length < 4 && !sigla) || STOP.has(w) || GENERICAS.has(w)) continue
    const r = raiz(w)
    if (vistos.has(r)) continue
    vistos.add(r)
    termos.push({ palavra: sigla ? original : original.toLowerCase(), raiz: r })
  }
  return termos.slice(0, 30)
}

function termosQueBatem(termos: Termo[], texto: string) {
  const doCurriculo = semAcento(texto)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
  return termos.filter((termo) => {
    const alvo = semAcento(termo.palavra)
    return doCurriculo.some((w) => w.startsWith(termo.raiz) || (w.length >= 4 && alvo.startsWith(raiz(w))))
  })
}

function listaCursos(cursos: string[]) {
  return cursos.length === 1 ? `O curso ${cursos[0]} ainda está` : `Os cursos ${cursos.join(', ')} ainda estão`
}

export function buscarPorAtividades(params: {
  atividades: string
  cidade: string
  estado?: string
  raioKm?: number | null
  origem?: { lat: number; lng: number }
  empresa: Empresa
  profissionais: Profissional[]
  documentos: DocumentoRegistro[]
}): BuscaMissao {
  const { empresa, profissionais, documentos } = params
  const termos = termosDasAtividades(params.atividades)
  const filtroLocal: FiltroLocal = {
    cidade: params.cidade,
    estado: params.estado,
    raioKm: params.raioKm,
    origem: params.origem ?? empresa.endereco,
    cidadeEmpresa: empresa.endereco.cidade,
  }
  const limitePerto = params.raioKm != null && params.raioKm > 0 ? params.raioKm : 40
  const lista: CurriculoAnalisado[] = []
  let analisados = 0
  if (!termos.length) return { analisados, pessoas: lista }

  for (const profissional of profissionais) {
    if (profissional.status !== 'aprovado') continue
    if (empresa.bloqueados.includes(profissional.id)) continue
    const local = localDaPessoa(profissional, filtroLocal)
    if (!local) continue
    const { mesmaCidade, distancia } = local
    analisados += 1

    const acertos = termosQueBatem(termos, textoCurriculo(profissional))
    if (!acertos.length) continue
    const batidas = acertos.map((t) => t.palavra)
    const pct = acertos.length / termos.length

    const cursos = certificadosDoCurriculo(profissional, documentos)
    const cursosOk = cursos.filter((c) => c.ok).map((c) => c.curso)
    const cursosFalta = cursos.filter((c) => !c.ok).map((c) => c.curso)
    const temCertificado = cursosOk.length > 0

    const aderencias = [`As atividades aparecem no currículo: ${batidas.slice(0, 8).join(', ')}.`]
    const falhas: string[] = []
    let score = Math.round(pct * 60)

    let melhor: { exp: Profissional['experiencia'][number]; n: number } | null = null
    for (const exp of profissional.experiencia) {
      const n = termosQueBatem(acertos, `${exp.cargo} ${exp.descricao}`).length
      if (n && (!melhor || n > melhor.n)) melhor = { exp, n }
    }
    if (melhor) {
      score += 10
      aderencias.push(`Experiência: ${melhor.exp.cargo}${melhor.exp.empresa ? ` em ${melhor.exp.empresa}` : ''}.`)
    }

    if (temCertificado) {
      score += Math.min(10, cursosOk.length * 5)
      aderencias.push(`Certificado aprovado: ${cursosOk.join(', ')}.`)
    } else if (cursos.length) {
      falhas.push(`Sem certificado aprovado. Cursos do currículo: ${cursosFalta.join(', ')}.`)
    } else {
      falhas.push('O currículo não tem curso com certificado.')
    }

    if (mesmaCidade) {
      score += 10
      aderencias.push(`Mora em ${profissional.endereco.cidade}/${profissional.endereco.estado}, a cidade pedida.`)
    } else if (distancia <= limitePerto) {
      score += 6
      aderencias.push(`Mora em ${profissional.endereco.cidade}/${profissional.endereco.estado}, a cerca de ${Math.round(distancia)} km.`)
    } else {
      falhas.push(`Mora em ${profissional.endereco.cidade}/${profissional.endereco.estado}, a cerca de ${Math.round(distancia)} km.`)
    }

    const resumoDocs = resumoDocumental(checklistProfissional(profissional, documentos))
    score += Math.round((resumoDocs.pct / 100) * 10)

    const disp = profissional.disponibilidade
    const disponivel =
      disp.temporario || disp.hoje || disp.amanha || disp.estaSemana || disp.noturno || disp.finaisDeSemana
    const porque = [
      `As atividades da vaga aparecem no currículo: ${batidas.slice(0, 6).join(', ')}.`,
      temCertificado
        ? `Tem certificado aprovado de ${cursosOk.join(', ')}. A escolha continua com a empresa tomadora.`
        : cursos.length
          ? `${listaCursos(cursosFalta)} sem certificado aprovado.`
          : 'O currículo não tem curso com certificado.',
    ].join(' ')

    lista.push({
      profissional,
      score: Math.max(0, Math.min(100, score)),
      leitura: porque,
      aderencias,
      falhas,
      situacao: 'compativel',
      situacaoTexto: '',
      diasPedido: 0,
      mesmaCidade,
      distanciaKm: Math.round(distancia * 10) / 10,
      checagens: [
        { rotulo: `Atividades ${acertos.length}/${termos.length}`, ok: true, obrigatorio: true },
        {
          rotulo: temCertificado ? `Certificado: ${cursosOk.join(', ')}` : 'Certificado aprovado',
          ok: temCertificado,
          obrigatorio: true,
        },
      ],
      atendeObrigatorios: temCertificado,
      anosExperiencia: anosExperiencia(profissional),
      porque,
      compatibilidade: {
        requisitos: temCertificado ? 'Atividades e certificado' : 'Falta certificado aprovado',
        experiencia: pct >= 0.5 ? 'Alta correspondência' : `Correspondência parcial: ${acertos.length} de ${termos.length} atividades`,
        disponibilidade: disponivel ? 'Compatível' : 'Sem disponibilidade marcada',
        localizacao: mesmaCidade || distancia <= limitePerto ? 'Compatível' : 'Distante da operação',
        certificacoes: temCertificado
          ? `${cursosOk.length} aprovado${cursosOk.length === 1 ? '' : 's'}`
          : cursos.length
            ? 'Falta certificado aprovado'
            : 'Sem certificado de curso',
      },
    })
  }

  lista.sort((a, b) => {
    if (a.atendeObrigatorios !== b.atendeObrigatorios) return a.atendeObrigatorios ? -1 : 1
    return b.score - a.score
  })

  return { analisados, pessoas: lista }
}
