import { cargoLabel } from '../data/categories'
import type { Avaliacao, Candidatura, Demanda, Pagamento, PecaDocumental, Profissional } from './types'

export const CHAVE_NOTIFICACOES = 'doca-livre-notificacoes-empresa-v1'

export type AvisoEmpresa = {
  id: string
  tipo: 'candidatura' | 'convite' | 'avaliacao' | 'contrato'
  quando: string
  nome: string
  texto: string
  extra: string
  aba: 'vagas' | 'missoes' | 'contratacoes'
  legado: boolean
}

type Registro = { lidas: string[] }

function tipoDoAviso(cand: Candidatura): 'candidatura' | 'convite' {
  if (cand.origem === 'candidatura') return 'candidatura'
  if (cand.origem === 'convite') return 'convite'
  return cand.score > 0 ? 'convite' : 'candidatura'
}

export function montarAvisosEmpresa(input: {
  empresaId: string
  demandas: Demanda[]
  candidaturas: Candidatura[]
  profissionais: Profissional[]
  avaliacoes?: Avaliacao[]
  pagamentos?: Pagamento[]
  pecas?: PecaDocumental[]
}): AvisoEmpresa[] {
  const demandas = new Map(
    input.demandas.filter((item) => item.empresaId === input.empresaId).map((item) => [item.id, item]),
  )
  const pessoas = new Map(input.profissionais.map((item) => [item.id, item]))
  const avisos: AvisoEmpresa[] = []

  for (const cand of input.candidaturas) {
    if (cand.status !== 'aceita' && cand.status !== 'confirmada') continue
    const demanda = demandas.get(cand.demandaId)
    if (!demanda) continue
    const tipo = tipoDoAviso(cand)
    const cargo = cargoLabel(demanda.cargo)
    const nome = pessoas.get(cand.profissionalId)?.nome ?? 'Colaborador'
    avisos.push({
      id: cand.id,
      tipo,
      quando: cand.respondidoEm || cand.createdAt,
      nome,
      texto:
        tipo === 'candidatura'
          ? `${nome} se candidatou à vaga de ${cargo}.`
          : `${nome} aceitou o convite de ${cargo}.`,
      extra: `${demanda.endereco.cidade}/${demanda.endereco.estado}`,
      aba: tipo === 'candidatura' ? 'vagas' : 'missoes',
      legado: !cand.respondidoEm,
    })
  }

  for (const peca of input.pecas ?? []) {
    if (peca.tipo !== 'contrato_ett_tomadora') continue
    const demanda = demandas.get(peca.demandaId)
    if (!demanda || demanda.status === 'cancelada') continue
    const minha = peca.assinaturas.find((a) => a.papel === 'tomadora')
    if (!minha || minha.status !== 'pendente') continue
    avisos.push({
      id: `contrato:${peca.id}`,
      tipo: 'contrato',
      quando: peca.criadoEm,
      nome: 'Doca Livre fazumfreela',
      texto: `Contrato para assinar com a fazumfreela: vaga de ${cargoLabel(demanda.cargo)}.`,
      extra: `${demanda.endereco.cidade}/${demanda.endereco.estado} · ${peca.numero}`,
      aba: 'vagas',
      legado: false,
    })
  }

  const avaliacoes = input.avaliacoes ?? []
  const pagamentos = input.pagamentos ?? []
  for (const demanda of demandas.values()) {
    if (demanda.status !== 'finalizada') continue
    const cargo = cargoLabel(demanda.cargo)
    const confirmados = input.candidaturas.filter(
      (item) => item.demandaId === demanda.id && item.status === 'confirmada',
    )
    for (const cand of confirmados) {
      const pessoa = pessoas.get(cand.profissionalId)
      if (!pessoa) continue
      const jaAvaliou = avaliacoes.some(
        (item) => item.demandaId === demanda.id && item.paraUserId === pessoa.userId && item.deRole === 'empresa',
      )
      if (jaAvaliou) continue
      const pagamento = pagamentos.find(
        (item) => item.demandaId === demanda.id && item.profissionalId === pessoa.id,
      )
      avisos.push({
        id: `avaliacao:${demanda.id}:${pessoa.id}`,
        tipo: 'avaliacao',
        quando: pagamento?.createdAt || demanda.createdAt,
        nome: pessoa.nome,
        texto: `${pessoa.nome} encerrou o contrato de ${cargo}. Avalie o trabalho.`,
        extra: `${demanda.endereco.cidade}/${demanda.endereco.estado}`,
        aba: 'contratacoes',
        legado: false,
      })
    }
  }

  avisos.sort((a, b) => b.quando.localeCompare(a.quando) || (a.tipo === 'avaliacao' ? -1 : 1))
  return avisos
}

function carregar(): Record<string, Registro> {
  try {
    const raw = localStorage.getItem(CHAVE_NOTIFICACOES)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Registro>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function salvar(dados: Record<string, Registro>) {
  localStorage.setItem(CHAVE_NOTIFICACOES, JSON.stringify(dados))
}

export function lidasDaEmpresa(empresaId: string) {
  return carregar()[empresaId]?.lidas ?? []
}

export function sincronizarLidas(empresaId: string, avisos: AvisoEmpresa[]) {
  const todos = carregar()
  const lidas = new Set(todos[empresaId]?.lidas ?? [])
  let mudou = !todos[empresaId]
  for (const aviso of avisos) {
    if (aviso.legado && !lidas.has(aviso.id)) {
      lidas.add(aviso.id)
      mudou = true
    }
  }
  const lista = [...lidas]
  if (mudou) {
    todos[empresaId] = { lidas: lista }
    salvar(todos)
  }
  return lista
}

export function marcarAvisosLidos(empresaId: string, ids: string[]) {
  const todos = carregar()
  const lidas = new Set([...(todos[empresaId]?.lidas ?? []), ...ids])
  const lista = [...lidas]
  todos[empresaId] = { lidas: lista }
  salvar(todos)
  return lista
}

export function horaDoAviso(iso: string) {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
