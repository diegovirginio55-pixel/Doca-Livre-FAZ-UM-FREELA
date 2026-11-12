// Grupos de hierarquia, no mesmo modelo do Oferta de Carga: a empresa existe uma vez; em cada grupo
// ela tem o próprio pai; a mesma empresa pode participar de vários grupos.
import type { Empresa, GrupoHierarquia, MembroGrupo } from './types'

export type NoDoGrupo = { empresa: Empresa; filhos: NoDoGrupo[] }

function novoId() {
  return `grupo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function criarGrupo(
  grupos: GrupoHierarquia[],
  dados: { nome: string; descricao: string; empresaId?: string },
): { grupos: GrupoHierarquia[]; erro?: string } {
  const nome = dados.nome.trim()
  if (!nome) return { grupos, erro: 'Informe o nome do grupo.' }
  if (grupos.some((g) => g.nome.trim().toLowerCase() === nome.toLowerCase())) {
    return { grupos, erro: 'Já existe um grupo com esse nome.' }
  }
  const empresaId = (dados.empresaId || '').trim()
  const grupo: GrupoHierarquia = {
    id: novoId(),
    nome,
    descricao: dados.descricao.trim(),
    empresaId,
    criadoEm: new Date().toISOString(),
    // Com empresa principal, o grupo já nasce com ela no topo; sem, as empresas entram depois.
    membros: empresaId ? [{ empresaId, paiEmpresaId: null, posicao: 0 }] : [],
  }
  return { grupos: [...grupos, grupo] }
}

export function excluirGrupo(grupos: GrupoHierarquia[], id: string) {
  return grupos.filter((g) => g.id !== id)
}

export function renomearGrupo(grupos: GrupoHierarquia[], id: string, dados: { nome: string; descricao: string }) {
  const nome = dados.nome.trim()
  if (!nome) return { grupos, erro: 'Informe o nome do grupo.' }
  if (grupos.some((g) => g.id !== id && g.nome.trim().toLowerCase() === nome.toLowerCase())) {
    return { grupos, erro: 'Já existe um grupo com esse nome.' }
  }
  return { grupos: grupos.map((g) => (g.id === id ? { ...g, nome, descricao: dados.descricao.trim() } : g)) }
}

function criariaCiclo(membros: MembroGrupo[], empresaId: string, paiId: string | null) {
  let atual = paiId
  const vistos = new Set<string>()
  while (atual) {
    if (atual === empresaId || vistos.has(atual)) return true
    vistos.add(atual)
    atual = membros.find((m) => m.empresaId === atual)?.paiEmpresaId ?? null
  }
  return false
}

/** Coloca a empresa no grupo (ou muda o pai dela, se já estiver). */
export function posicionarNoGrupo(
  grupos: GrupoHierarquia[],
  grupoId: string,
  empresaId: string,
  paiEmpresaId: string | null,
): { grupos: GrupoHierarquia[]; erro?: string } {
  const grupo = grupos.find((g) => g.id === grupoId)
  if (!grupo) return { grupos, erro: 'Grupo não encontrado.' }
  if (!empresaId) return { grupos, erro: 'Escolha a empresa.' }
  if (paiEmpresaId && !grupo.membros.some((m) => m.empresaId === paiEmpresaId)) {
    return { grupos, erro: 'A empresa de cima precisa estar neste grupo.' }
  }
  if (paiEmpresaId === empresaId || criariaCiclo(grupo.membros, empresaId, paiEmpresaId)) {
    return { grupos, erro: 'Assim a empresa ficaria abaixo dela mesma.' }
  }
  const existe = grupo.membros.some((m) => m.empresaId === empresaId)
  const membros = existe
    ? grupo.membros.map((m) => (m.empresaId === empresaId ? { ...m, paiEmpresaId } : m))
    : [...grupo.membros, { empresaId, paiEmpresaId, posicao: grupo.membros.length }]
  return { grupos: grupos.map((g) => (g.id === grupoId ? { ...g, membros } : g)) }
}

/** Tira a empresa do grupo; quem estava abaixo dela sobe para o lugar dela. */
export function tirarDoGrupo(grupos: GrupoHierarquia[], grupoId: string, empresaId: string) {
  return grupos.map((g) => {
    if (g.id !== grupoId) return g
    const saindo = g.membros.find((m) => m.empresaId === empresaId)
    if (!saindo) return g
    return {
      ...g,
      empresaId: g.empresaId === empresaId ? '' : g.empresaId,
      membros: g.membros
        .filter((m) => m.empresaId !== empresaId)
        .map((m) => (m.paiEmpresaId === empresaId ? { ...m, paiEmpresaId: saindo.paiEmpresaId } : m)),
    }
  })
}

/** Desenho do grupo: empresas que sumiram do sistema ficam de fora; pai ausente vira topo. */
export function arvoreDoGrupo(grupo: GrupoHierarquia, empresas: Empresa[]): NoDoGrupo[] {
  const porId = new Map(empresas.map((e) => [e.id, e]))
  const membros = [...grupo.membros].filter((m) => porId.has(m.empresaId)).sort((a, b) => a.posicao - b.posicao)
  const nos = new Map(membros.map((m) => [m.empresaId, { empresa: porId.get(m.empresaId)!, filhos: [] as NoDoGrupo[] }]))
  const raizes: NoDoGrupo[] = []
  for (const m of membros) {
    const no = nos.get(m.empresaId)!
    const pai = m.paiEmpresaId ? nos.get(m.paiEmpresaId) : undefined
    if (pai && !criariaCiclo(membros, m.empresaId, m.paiEmpresaId)) pai.filhos.push(no)
    else raizes.push(no)
  }
  return raizes
}

export function contarNosDoGrupo(nos: NoDoGrupo[]): number {
  return nos.reduce((soma, n) => soma + 1 + contarNosDoGrupo(n.filhos), 0)
}
