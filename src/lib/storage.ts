import { mediaDaAvaliacao, resumoAvaliacaoEmpresa } from './classificacao'
import { emDemo } from './modo'
import { createSeedState } from './seed'
import { cadastroEttInicial, pecasDaContratacao } from './dossieTemporario'
import type { AppState } from './types'

/** Real e demo em chaves separadas: os dados fictícios nunca se misturam com os reais. */
export const STORAGE_KEY = emDemo() ? 'doca-livre-mao-de-obra-demo-v1' : 'doca-livre-mao-de-obra-v8'

function fecharVagasComContrato(state: AppState) {
  if (!Array.isArray(state.demandas) || !Array.isArray(state.candidaturas)) return false
  const fechadas = new Set<string>()
  let mudou = false
  for (const demanda of state.demandas) {
    if (demanda.status === 'cancelada' || demanda.status === 'finalizada') continue
    const confirmados = state.candidaturas.filter(
      (item) => item.demandaId === demanda.id && item.status === 'confirmada',
    ).length
    if (demanda.quantidade > 0 && confirmados >= demanda.quantidade) {
      fechadas.add(demanda.id)
      if (demanda.status === 'aberta') {
        demanda.status = 'em_andamento'
        mudou = true
      }
    }
  }
  for (const candidatura of state.candidaturas) {
    if (!fechadas.has(candidatura.demandaId)) continue
    if (candidatura.status === 'pendente' || candidatura.status === 'aceita') {
      candidatura.status = 'cancelada'
      mudou = true
    }
  }
  return mudou
}

function completarPecasDasContratacoes(state: AppState) {
  if (!Array.isArray(state.candidaturas) || !Array.isArray(state.demandas)) return false
  let mudou = false
  for (const candidatura of state.candidaturas) {
    if (candidatura.status !== 'confirmada') continue
    const demanda = state.demandas.find((d) => d.id === candidatura.demandaId)
    if (!demanda || demanda.status === 'finalizada' || demanda.status === 'cancelada') continue
    const empresa = state.empresas?.find((e) => e.id === demanda.empresaId)
    const profissional = state.profissionais?.find((p) => p.id === candidatura.profissionalId)
    if (!empresa || !profissional) continue
    const novas = pecasDaContratacao({
      pecas: state.pecas ?? [],
      demanda,
      empresa,
      profissional,
      ett: state.cadastroEtt ?? cadastroEttInicial(),
      candidaturaId: candidatura.id,
    })
    if (novas.length) {
      state.pecas = [...novas, ...(state.pecas ?? [])]
      mudou = true
    }
  }
  return mudou
}

/** Estado sem nenhum dado: ponto de partida do modo real (tudo vem do banco depois do login). */
export function estadoVazio(): AppState {
  return {
    users: [],
    empresas: [],
    profissionais: [],
    demandas: [],
    candidaturas: [],
    checkIns: [],
    avaliacoes: [],
    pagamentos: [],
    auditLogs: [],
    infracoes: [],
    sinistros: [],
    operacoes: [],
    perfisIdeais: [],
    enderecosEmpresa: [],
    veiculos: [],
    relatorios: [],
    modelosVaga: [],
    contratos: [],
    documentos: [],
    pecas: [],
    cadastroEtt: cadastroEttInicial(),
    sessionUserId: null,
  }
}

function estadoInicial(): AppState {
  return emDemo() ? createSeedState() : estadoVazio()
}

/**
 * Nível e nota média do profissional vêm das avaliações; no modo real, saldo e ganhos do mês
 * vêm dos pagamentos. Assim valem iguais em qualquer aparelho — antes eram gravados no perfil
 * pelo navegador da empresa, o banco não aceitava (o perfil é do profissional) e a sincronização
 * desfazia a nota e o pagamento em até 30 segundos.
 */
export function recalcularDerivados(state: AppState): AppState {
  const comEmpresas = notaDasEmpresas(state)
  if (comEmpresas !== state) state = comEmpresas
  if (!Array.isArray(state.profissionais) || !state.profissionais.length) return state
  const avaliacoes = Array.isArray(state.avaliacoes) ? state.avaliacoes : []
  const pagamentos = Array.isArray(state.pagamentos) ? state.pagamentos : []
  const real = !emDemo()
  const mes = new Date().toISOString().slice(0, 7)
  let mudou = false
  const profissionais = state.profissionais.map((pessoa) => {
    const resumo = resumoAvaliacaoEmpresa(avaliacoes, pessoa.userId)
    const nivel = resumo.quantidade > 0 ? resumo.nivel : 'bronze'
    const media = resumo.quantidade > 0 ? resumo.media : pessoa.avaliacaoMedia
    let saldo = pessoa.saldo
    let ganhosMes = pessoa.ganhosMes
    if (real) {
      const pagos = pagamentos.filter((p) => p.profissionalId === pessoa.id && p.status === 'pago')
      saldo = Math.round(pagos.reduce((soma, p) => soma + p.valor, 0) * 100) / 100
      ganhosMes =
        Math.round(
          pagos.filter((p) => String(p.createdAt || '').slice(0, 7) === mes).reduce((s, p) => s + p.valor, 0) *
            100,
        ) / 100
    }
    if (pessoa.nivel === nivel && pessoa.avaliacaoMedia === media && pessoa.saldo === saldo && pessoa.ganhosMes === ganhosMes) {
      return pessoa
    }
    mudou = true
    return { ...pessoa, nivel, avaliacaoMedia: media, saldo, ganhosMes }
  })
  return mudou ? { ...state, profissionais } : state
}

/** Nota da empresa = média das avaliações feitas pelos profissionais (antes nunca mudava). */
function notaDasEmpresas(state: AppState): AppState {
  if (!Array.isArray(state.empresas) || !Array.isArray(state.avaliacoes) || !state.avaliacoes.length) return state
  let mudou = false
  const empresas = state.empresas.map((empresa) => {
    const notas = state.avaliacoes.filter((a) => a.paraUserId === empresa.userId && a.deRole === 'profissional')
    if (!notas.length) return empresa
    const media =
      Math.round((notas.reduce((soma, a) => soma + mediaDaAvaliacao(a.notas), 0) / notas.length) * 10) / 10
    if (media === empresa.avaliacaoMedia) return empresa
    mudou = true
    return { ...empresa, avaliacaoMedia: media }
  })
  return mudou ? { ...state, empresas } : state
}

export function loadState(): AppState {
  if (!emDemo()) apagarChavesAntigas()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const inicial = estadoInicial()
      saveState(inicial)
      return inicial
    }
    let parsed = { ...estadoVazio(), ...(JSON.parse(raw) as AppState) }
    if (!parsed.cadastroEtt) parsed.cadastroEtt = cadastroEttInicial()
    parsed = recalcularDerivados(parsed)
    fecharVagasComContrato(parsed)
    completarPecasDasContratacoes(parsed)
    if (emDemo() && parsed.profissionais.some((pessoa) => !pessoa.foto)) {
      const fotos = new Map(
        createSeedState().profissionais.filter((pessoa) => pessoa.foto).map((pessoa) => [pessoa.id, pessoa.foto]),
      )
      for (const pessoa of parsed.profissionais) {
        if (!pessoa.foto) pessoa.foto = fotos.get(pessoa.id)
      }
    }
    saveState(parsed)
    return parsed
  } catch {
    const inicial = estadoInicial()
    saveState(inicial)
    return inicial
  }
}

/**
 * Até a v7 o estado real e o demo dividiam a mesma chave, com as senhas de todo mundo em
 * texto puro. Some de qualquer navegador que abrir o app.
 */
function apagarChavesAntigas() {
  try {
    for (let v = 1; v <= 7; v += 1) localStorage.removeItem(`doca-livre-mao-de-obra-v${v}`)
    localStorage.removeItem('mao-portal-otp-v1')
    localStorage.removeItem('mao-portal-otp-meta-v2')
  } catch {
    /* ignore */
  }
}

/** Cópia sem o base64 dos arquivos. `todos=false` só tira o que já está salvo na nuvem. */
function semArquivos(state: AppState, todos: boolean): AppState {
  if (!Array.isArray(state.documentos)) return state
  return {
    ...state,
    documentos: state.documentos.map((doc) => {
      if (!todos && !doc.meta?.storagePath) return doc
      if (!doc.arquivoDados && !doc.meta?.versoDados) return doc
      const { versoDados: _verso, ...meta } = doc.meta || {}
      return { ...doc, arquivoDados: undefined, meta }
    }),
  }
}

/**
 * Grava o estado no localStorage (~5 MB). Os documentos do cadastro em base64 estouram essa cota;
 * antes o erro subia de dentro do setState e a tela ficava em branco.
 */
export function saveState(state: AppState) {
  const versoes = [() => state, () => semArquivos(state, false), () => semArquivos(state, true)]
  for (const versao of versoes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(versao()))
      return
    } catch {
      /* cota cheia ou storage bloqueado: tenta uma cópia menor */
    }
  }
  console.warn('[storage] não foi possível gravar o estado no navegador')
}

export function resetState(): AppState {
  const inicial = estadoInicial()
  saveState(inicial)
  return inicial
}
