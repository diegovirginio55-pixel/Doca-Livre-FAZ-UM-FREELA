import { cargoLabel } from '../data/categories'
import { effectiveStatus } from './documentos'
import { rotuloMotivo } from './modalidadeContratacao'
import { dataLocal } from './ponto'
import { nowIso, uid } from './seed'
import type {
  CadastroEtt,
  Demanda,
  DocumentoRegistro,
  Empresa,
  PecaDocumental,
  Profissional,
} from './types'

export const AVISO_MINUTA =
  'Modelo para controle do sistema. O texto jurídico definitivo deve ser revisado por advogado trabalhista antes de contratação real.'

export const ETT_ID = 'ett'

export function cadastroEttInicial(): CadastroEtt {
  return {
    razaoSocial: 'DOCA LIVRE MÃO DE OBRA LTDA',
    nomeFantasia: 'Doca Livre fazumfreela',
    cnpj: '',
    juntaComercial: '',
    socios: '',
    documentosSocios: '',
    capitalSocial: '',
    cnae: '',
    sede: '',
    registroSirett: '',
    certificadoRegistro: '',
    certificadoDigital: '',
    procuracoes: '',
  }
}

export const PASTAS_DOCUMENTAIS = [
  {
    id: 'ett',
    titulo: 'Empresa de trabalho temporário',
    itens: ['Contrato social', 'CNPJ', 'Registro SIRETT', 'Certificado', 'Documentos societários'],
  },
  {
    id: 'tomadora',
    titulo: 'Empresa tomadora',
    itens: ['Cadastro', 'Documentos', 'Contratos'],
  },
  {
    id: 'trabalhador',
    titulo: 'Trabalhador',
    itens: ['Cadastro', 'Currículo', 'Documentos pessoais', 'Certificações', 'ASO', 'Treinamentos'],
  },
  {
    id: 'demanda',
    titulo: 'Demanda',
    itens: ['Solicitação', 'Requisitos', 'Justificativa', 'Observações'],
  },
  {
    id: 'contratacao',
    titulo: 'Contratação',
    itens: ['Contrato ETT e tomadora', 'Contrato individual temporário', 'Assinaturas', 'Admissão', 'eSocial'],
  },
  {
    id: 'missao',
    titulo: 'Missão',
    itens: ['Jornada', 'Ocorrências', 'EPIs', 'Avaliações'],
  },
  {
    id: 'encerramento',
    titulo: 'Encerramento',
    itens: ['Rescisão ou encerramento', 'Pagamentos', 'Documentos finais', 'Histórico'],
  },
] as const

export const VISIVEL_PARA_TOMADORA = [
  'Nome',
  'Experiência',
  'Competências e requisitos atendidos',
  'Certificações exigidas pela missão',
  'Disponibilidade',
  'Cidade',
]

export function proximoNumero(pecas: PecaDocumental[], prefixo: string) {
  const seq = pecas.filter((p) => p.numero.startsWith(`${prefixo}-`)).length + 1
  return `${prefixo}-${String(seq).padStart(6, '0')}`
}

function dataBr(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/**
 * Dia local de um instante. `iso.slice(0, 10)` pega o dia em UTC: pagamento feito depois das 21h
 * (Brasília) saía com a data de amanhã no recibo. Data pura (AAAA-MM-DD) fica como está.
 */
function diaLocal(valor: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  return dataLocal(valor) || valor.slice(0, 10)
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function linhasMissao(demanda: Demanda, empresa: Empresa, ett: CadastroEtt) {
  const fim = demanda.dataFim || demanda.data
  return [
    `Tomadora: ${empresa.nomeFantasia}`,
    `Empresa de trabalho temporário: ${ett.nomeFantasia}`,
    `Registro SIRETT: ${ett.registroSirett.trim() || 'não informado'}`,
    `Cargo: ${cargoLabel(demanda.cargo)}`,
    `Quantidade: ${demanda.quantidade}`,
    `Local: ${demanda.endereco.cidade}/${demanda.endereco.estado}`,
    `Início: ${dataBr(demanda.data)}`,
    `Término previsto: ${dataBr(fim)}`,
    `Jornada: ${demanda.horaInicio}–${demanda.horaFim}`,
    `Remuneração prevista: ${demanda.valorDiaria ? `${moeda(demanda.valorDiaria)} por dia` : 'a informar'}`,
    `Motivo: ${demanda.motivo ? rotuloMotivo(demanda.motivo) : 'não informado'}`,
    `Atividades: ${demanda.atividades || demanda.descricao || 'não informadas'}`,
    `Requisitos: ${demanda.requisitos.join(', ') || 'não informados'}`,
    `Observações: ${demanda.observacoes || 'sem observações'}`,
    'Segurança e saúde: ASO, treinamentos e EPIs da função ficam na pasta do trabalhador. O sistema não emite ASO.',
  ]
}

export function criarPecasIniciais(params: {
  pecas: PecaDocumental[]
  demanda: Demanda
  empresa: Empresa
  ett: CadastroEtt
  signatarioTomadora: string
}): PecaDocumental[] {
  const { pecas, demanda, empresa, ett, signatarioTomadora } = params
  if (pecas.some((p) => p.demandaId === demanda.id && p.tipo === 'solicitacao')) return []
  const agora = nowIso()
  const base = linhasMissao(demanda, empresa, ett)
  const solicitacao: PecaDocumental = {
    id: uid('peca'),
    numero: proximoNumero(pecas, 'MOT'),
    tipo: 'solicitacao',
    status: 'registrada',
    demandaId: demanda.id,
    empresaId: empresa.id,
    titulo: 'Solicitação de trabalho temporário',
    resumo: base,
    assinaturas: [
      { papel: 'tomadora', nome: signatarioTomadora || empresa.responsavelNome, status: 'assinado', em: agora },
    ],
    criadoEm: agora,
    aviso: AVISO_MINUTA,
  }
  const contrato: PecaDocumental = {
    id: uid('peca'),
    numero: proximoNumero([solicitacao, ...pecas], 'CTR'),
    tipo: 'contrato_ett_tomadora',
    status: 'aguardando_assinatura',
    demandaId: demanda.id,
    empresaId: empresa.id,
    titulo: 'Contrato de prestação de serviços de colocação de trabalhador temporário',
    resumo: [
      'Partes: empresa de trabalho temporário e empresa tomadora.',
      'O trabalhador é contratado pela empresa de trabalho temporário e colocado à disposição da tomadora.',
      ...base,
      'O contrato escrito precisa qualificar as partes e registrar a justificativa da demanda, o prazo, o valor da prestação e as disposições de segurança e saúde.',
    ],
    assinaturas: [
      { papel: 'ett', nome: ett.nomeFantasia, status: 'pendente' },
      { papel: 'tomadora', nome: signatarioTomadora || empresa.responsavelNome, status: 'pendente' },
    ],
    criadoEm: agora,
    aviso: AVISO_MINUTA,
    meta: { decreto: 'Decreto 10.854/2021 — elementos do contrato escrito' },
  }
  return [solicitacao, contrato]
}

export function criarContratoIndividual(params: {
  pecas: PecaDocumental[]
  demanda: Demanda
  empresa: Empresa
  profissional: Profissional
  ett: CadastroEtt
  candidaturaId: string
}): PecaDocumental | null {
  const { pecas, demanda, empresa, profissional, ett, candidaturaId } = params
  if (pecas.some((p) => p.candidaturaId === candidaturaId && p.tipo === 'contrato_individual')) return null
  const fim = demanda.dataFim || demanda.data
  return {
    id: uid('peca'),
    numero: proximoNumero(pecas, 'CIT'),
    tipo: 'contrato_individual',
    status: 'aguardando_assinatura',
    demandaId: demanda.id,
    empresaId: empresa.id,
    profissionalId: profissional.id,
    candidaturaId,
    titulo: 'Contrato individual de trabalho temporário',
    resumo: [
      `Empregador: ${ett.nomeFantasia}`,
      `Trabalhador: ${profissional.nome}`,
      `Tomadora: ${empresa.nomeFantasia}`,
      `Função: ${cargoLabel(demanda.cargo)}`,
      `Local: ${demanda.endereco.cidade}/${demanda.endereco.estado}`,
      `Início: ${dataBr(demanda.data)}`,
      `Término: ${dataBr(fim)}`,
      `Jornada: ${demanda.horaInicio}–${demanda.horaFim}`,
      `Remuneração: ${demanda.valorDiaria ? `${moeda(demanda.valorDiaria)} por dia` : 'a informar'}`,
      `Motivo da contratação: ${demanda.motivo ? rotuloMotivo(demanda.motivo) : 'não informado'}`,
      'Natureza: contrato de trabalho temporário da Lei 6.019/1974, com a empresa de trabalho temporário como empregadora e colocação do trabalhador à disposição da tomadora pelo prazo e pelo motivo desta missão.',
      'Prazo: até 180 dias, prorrogável por mais 90 dias quando mantido o motivo. A condição de temporário é anotada na carteira de trabalho.',
      'Direitos: remuneração equivalente à dos empregados da mesma categoria da tomadora, jornada de até 8 horas diárias, horas extras com acréscimo mínimo de 50%, repouso semanal remunerado, adicional noturno, férias e 13º proporcionais, FGTS, seguro contra acidente de trabalho e proteção previdenciária.',
      'Segurança: a tomadora garante as condições de segurança, higiene e salubridade no local de trabalho. O trabalhador segue as normas de segurança e usa os EPIs entregues.',
      'Rescisão: o encerramento antes do prazo é registrado em documento próprio, assinado pelas partes.',
      'eSocial: admissão pelo evento S-2200, categoria 106 (trabalhador temporário da Lei 6.019/1974). O sistema não transmite o evento.',
    ],
    assinaturas: [
      { papel: 'ett', nome: ett.nomeFantasia, status: 'pendente' },
      { papel: 'trabalhador', nome: profissional.nome, status: 'pendente' },
    ],
    criadoEm: nowIso(),
    aviso: AVISO_MINUTA,
    meta: { esocial: 'pendente', categoriaEsocial: '106' },
  }
}

function episDaMissao(demanda: Demanda) {
  const itens = (demanda.epis || '')
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter((item) => item && !/^vale|refei|alimenta|transporte/i.test(item))
  return itens.length ? itens : ['EPIs da função, conforme o programa de riscos da tomadora']
}

export function criarTermoIntegracao(params: {
  pecas: PecaDocumental[]
  demanda: Demanda
  empresa: Empresa
  profissional: Profissional
  candidaturaId: string
}): PecaDocumental | null {
  const { pecas, demanda, empresa, profissional, candidaturaId } = params
  if (pecas.some((p) => p.candidaturaId === candidaturaId && p.tipo === 'termo_integracao')) return null
  return {
    id: uid('peca'),
    numero: proximoNumero(pecas, 'INT'),
    tipo: 'termo_integracao',
    status: 'aguardando_assinatura',
    demandaId: demanda.id,
    empresaId: empresa.id,
    profissionalId: profissional.id,
    candidaturaId,
    titulo: 'Termo de integração e normas de segurança',
    resumo: [
      `Trabalhador: ${profissional.nome}`,
      `Tomadora: ${empresa.nomeFantasia}`,
      `Função: ${cargoLabel(demanda.cargo)}`,
      `Local: ${demanda.endereco.cidade}/${demanda.endereco.estado}`,
      'Declaro que recebi as orientações de integração: riscos da função, rotas de fuga, uso de equipamentos e regras internas do local.',
      'Comprometo-me a seguir as normas de segurança, usar os EPIs entregues e comunicar qualquer acidente ou condição de risco ao responsável da tomadora.',
      'A integração pode ser presencial ou online, conforme a tomadora definir antes do início.',
    ],
    assinaturas: [{ papel: 'trabalhador', nome: profissional.nome, status: 'pendente' }],
    criadoEm: nowIso(),
    aviso: AVISO_MINUTA,
  }
}

export function criarFichaEpi(params: {
  pecas: PecaDocumental[]
  demanda: Demanda
  empresa: Empresa
  profissional: Profissional
  candidaturaId: string
}): PecaDocumental | null {
  const { pecas, demanda, empresa, profissional, candidaturaId } = params
  if (pecas.some((p) => p.candidaturaId === candidaturaId && p.tipo === 'ficha_epi')) return null
  return {
    id: uid('peca'),
    numero: proximoNumero(pecas, 'EPI'),
    tipo: 'ficha_epi',
    status: 'aguardando_assinatura',
    demandaId: demanda.id,
    empresaId: empresa.id,
    profissionalId: profissional.id,
    candidaturaId,
    titulo: 'Ficha de entrega de EPI',
    resumo: [
      `Trabalhador: ${profissional.nome}`,
      `Função: ${cargoLabel(demanda.cargo)}`,
      `EPIs: ${episDaMissao(demanda).join(', ')}`,
      'Declaro que recebi os EPIs listados, em bom estado, e o treinamento sobre o uso correto.',
      'Comprometo-me a usar os EPIs apenas na atividade, guardá-los, comunicar dano ou extravio e devolvê-los no fim da missão, conforme a NR-6.',
    ],
    assinaturas: [{ papel: 'trabalhador', nome: profissional.nome, status: 'pendente' }],
    criadoEm: nowIso(),
    aviso: AVISO_MINUTA,
  }
}

/** Peças que faltam para uma candidatura confirmada. Não repete o que já existe. */
export function pecasDaContratacao(params: {
  pecas: PecaDocumental[]
  demanda: Demanda
  empresa: Empresa
  profissional: Profissional
  ett: CadastroEtt
  candidaturaId: string
}): PecaDocumental[] {
  const novas: PecaDocumental[] = []
  const todas = () => [...novas, ...params.pecas]
  novas.push(
    ...criarPecasIniciais({
      pecas: todas(),
      demanda: params.demanda,
      empresa: params.empresa,
      ett: params.ett,
      signatarioTomadora: params.empresa.responsavelNome,
    }),
  )
  const individual = criarContratoIndividual({ ...params, pecas: todas() })
  if (individual) novas.push(individual)
  const integracao = criarTermoIntegracao({ ...params, pecas: todas() })
  if (integracao) novas.push(integracao)
  const epi = criarFichaEpi({ ...params, pecas: todas() })
  if (epi) novas.push(epi)
  return novas
}

export function criarRecibo(params: {
  pecas: PecaDocumental[]
  demanda: Demanda
  empresa: Empresa
  profissional: Profissional
  valor: number
  dias: number
  pagoEm: string
}): PecaDocumental | null {
  const { pecas, demanda, empresa, profissional } = params
  if (pecas.some((p) => p.tipo === 'recibo' && p.demandaId === demanda.id && p.profissionalId === profissional.id)) {
    return null
  }
  return {
    id: uid('peca'),
    numero: proximoNumero(pecas, 'REC'),
    tipo: 'recibo',
    status: 'aguardando_assinatura',
    demandaId: demanda.id,
    empresaId: empresa.id,
    profissionalId: profissional.id,
    titulo: 'Recibo de pagamento',
    resumo: [
      `Trabalhador: ${profissional.nome}`,
      `Tomadora: ${empresa.nomeFantasia}`,
      `Função: ${cargoLabel(demanda.cargo)}`,
      `Período: ${dataBr(demanda.data)} a ${dataBr(demanda.dataFim || demanda.data)}`,
      `Dias: ${params.dias} · Diária: ${moeda(demanda.valorDiaria)}`,
      `Valor: ${moeda(params.valor)}`,
      `Pago em: ${dataBr(diaLocal(params.pagoEm))}`,
      'Declaro que recebi o valor acima pela missão temporária descrita.',
    ],
    assinaturas: [{ papel: 'trabalhador', nome: profissional.nome, status: 'pendente' }],
    criadoEm: nowIso(),
    aviso: AVISO_MINUTA,
  }
}

export function criarEncerramento(params: {
  pecas: PecaDocumental[]
  demanda: Demanda
  dataEfetiva: string
  motivo: string
  responsavel: string
  observacoes: string
  profissionalId?: string
  profissionalNome?: string
  ettNome?: string
}): PecaDocumental {
  const fim = params.demanda.dataFim || params.demanda.data
  const antecipada = params.dataEfetiva < fim
  const prazo = new Date(`${params.dataEfetiva}T12:00:00`)
  prazo.setDate(prazo.getDate() + 2)
  const prazoIso = dataLocal(prazo)
  return {
    id: uid('peca'),
    numero: proximoNumero(params.pecas, 'ENC'),
    tipo: 'encerramento',
    status: params.profissionalId ? 'aguardando_assinatura' : 'encerrada',
    demandaId: params.demanda.id,
    empresaId: params.demanda.empresaId,
    profissionalId: params.profissionalId,
    titulo: antecipada ? 'Rescisão antecipada' : 'Encerramento da missão',
    resumo: [
      ...(params.profissionalNome ? [`Trabalhador: ${params.profissionalNome}`] : []),
      `Término previsto: ${dataBr(fim)}`,
      `Data efetiva: ${dataBr(params.dataEfetiva)}`,
      `Motivo: ${params.motivo}`,
      `Responsável: ${params.responsavel}`,
      `Observações: ${params.observacoes || 'sem observações'}`,
      antecipada
        ? `Rescisão antecipada de contrato temporário deve ser informada no SIRETT em até 2 dias após o encerramento. Prazo indicado: ${dataBr(prazoIso)}. O sistema não envia essa informação ao Ministério do Trabalho.`
        : 'Encerramento no prazo previsto. Verbas, última jornada e situação no eSocial ficam a cargo de quem responde pela obrigação.',
      ...(params.profissionalId
        ? ['O trabalhador declara ciência do encerramento e a devolução dos EPIs e materiais recebidos.']
        : []),
    ],
    assinaturas: params.profissionalId
      ? [
          { papel: 'ett', nome: params.ettNome || 'Empresa de trabalho temporário', status: 'pendente' },
          { papel: 'trabalhador', nome: params.profissionalNome || 'Trabalhador', status: 'pendente' },
        ]
      : [],
    criadoEm: nowIso(),
    aviso: AVISO_MINUTA,
    meta: {
      antecipada: antecipada ? 'sim' : 'nao',
      dataEfetiva: params.dataEfetiva,
      sirettInformarAte: antecipada ? prazoIso : '',
    },
  }
}

function assinaturaOk(peca: PecaDocumental | undefined, papel: AssinaturaPapel) {
  return Boolean(peca?.assinaturas.some((a) => a.papel === papel && a.status === 'assinado'))
}

type AssinaturaPapel = PecaDocumental['assinaturas'][number]['papel']

export function pendenciasParaIniciar(params: {
  pecas: PecaDocumental[]
  documentos: DocumentoRegistro[]
  demandaId: string
  profissionalId: string
}) {
  const daDemanda = params.pecas.filter((p) => p.demandaId === params.demandaId)
  if (daDemanda.length === 0) return []

  const faltas: string[] = []
  if (!daDemanda.some((p) => p.tipo === 'solicitacao')) faltas.push('Solicitação de trabalho temporário')

  const ettTomadora = daDemanda.find((p) => p.tipo === 'contrato_ett_tomadora')
  if (!assinaturaOk(ettTomadora, 'ett') || !assinaturaOk(ettTomadora, 'tomadora')) {
    faltas.push('Contrato entre a empresa de trabalho temporário e a tomadora, assinado pelos dois')
  }

  const individual = daDemanda.find(
    (p) => p.tipo === 'contrato_individual' && p.profissionalId === params.profissionalId,
  )
  if (!assinaturaOk(individual, 'ett') || !assinaturaOk(individual, 'trabalhador')) {
    faltas.push('Contrato individual de trabalho temporário, assinado pela empresa de trabalho temporário e pelo trabalhador')
  }
  if (individual?.meta?.esocial !== 'informado') {
    faltas.push('Admissão informada no eSocial (S-2200, categoria 106)')
  }

  const doTrabalhador = (tipo: PecaDocumental['tipo']) =>
    daDemanda.find((p) => p.tipo === tipo && p.profissionalId === params.profissionalId)
  if (!assinaturaOk(doTrabalhador('termo_integracao'), 'trabalhador')) {
    faltas.push('Termo de integração e normas de segurança assinado pelo trabalhador')
  }
  if (!assinaturaOk(doTrabalhador('ficha_epi'), 'trabalhador')) {
    faltas.push('Ficha de entrega de EPI assinada pelo trabalhador')
  }

  const aso = params.documentos.find(
    (d) => d.donoTipo === 'profissional' && d.donoId === params.profissionalId && d.tipoId === 'aso',
  )
  if (!aso || effectiveStatus(aso) !== 'aprovado') {
    faltas.push('ASO apto, emitido pelo serviço de saúde ocupacional e aprovado no sistema')
  }

  return faltas
}

export function atualizarAssinatura(peca: PecaDocumental, papel: AssinaturaPapel, nome: string): PecaDocumental {
  const assinaturas = peca.assinaturas.map((a) =>
    a.papel === papel ? { ...a, status: 'assinado' as const, nome, em: nowIso() } : a,
  )
  const todos = assinaturas.every((a) => a.status === 'assinado')
  return {
    ...peca,
    assinaturas,
    status: todos && peca.status === 'aguardando_assinatura' ? 'concluida' : peca.status,
  }
}
