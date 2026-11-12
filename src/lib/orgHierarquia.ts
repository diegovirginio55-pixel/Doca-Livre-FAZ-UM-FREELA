// Hierarquia das empresas, a mesma do Oferta de Carga:
// Operador Logístico → Filial do Operador → Embarcador → Unidade → Transportadora.
// O embarcador também pode ficar direto no operador; unidade e transportadora também na filial.
// No topo só entram Operador Logístico ou Embarcador. O servidor confere as mesmas regras.
import type { Empresa, OrgTipo } from './types'

export const ORG_TIPOS: OrgTipo[] = ['operador_logistico', 'filial_operador', 'embarcador', 'unidade', 'transportadora']

export const ORG_TIPO_LABEL: Record<OrgTipo, string> = {
  operador_logistico: 'Operador Logístico',
  filial_operador: 'Filial do Operador',
  embarcador: 'Embarcador',
  unidade: 'Unidade',
  transportadora: 'Transportadora',
}

const PAIS_VALIDOS: Record<OrgTipo, OrgTipo[]> = {
  operador_logistico: [],
  filial_operador: ['operador_logistico'],
  embarcador: ['filial_operador', 'operador_logistico'],
  unidade: ['embarcador', 'filial_operador'],
  transportadora: ['unidade', 'filial_operador'],
}

export const TIPOS_NO_TOPO: OrgTipo[] = ['operador_logistico', 'embarcador']

/** Tipos que podem nascer abaixo de um ponto (sem pai = topo). */
export function tiposFilhos(tipoPai: OrgTipo | null | undefined): OrgTipo[] {
  if (!tipoPai) return TIPOS_NO_TOPO
  return ORG_TIPOS.filter((t) => PAIS_VALIDOS[t].includes(tipoPai))
}

export function podeFicarAbaixo(tipo: OrgTipo, tipoPai: OrgTipo | null | undefined) {
  return tipoPai ? PAIS_VALIDOS[tipo].includes(tipoPai) : TIPOS_NO_TOPO.includes(tipo)
}

export type NoEmpresa = { empresa: Empresa; tipo: OrgTipo; filhos: NoEmpresa[] }

/**
 * Monta a árvore a partir das empresas. Quem não tem tipo fica "fora da hierarquia" (ex.: empresa
 * que se cadastrou sozinha e ainda não foi posicionada). Pai sumido ou inválido: vira topo.
 */
export function montarArvoreEmpresas(empresas: Empresa[]): { raizes: NoEmpresa[]; fora: Empresa[] } {
  const nos = new Map<string, NoEmpresa>()
  const fora: Empresa[] = []
  for (const empresa of empresas) {
    if (empresa.orgTipo && ORG_TIPOS.includes(empresa.orgTipo)) {
      nos.set(empresa.id, { empresa, tipo: empresa.orgTipo, filhos: [] })
    } else {
      fora.push(empresa)
    }
  }
  const raizes: NoEmpresa[] = []
  for (const no of nos.values()) {
    const pai = no.empresa.orgPaiId ? nos.get(no.empresa.orgPaiId) : undefined
    if (pai && pai !== no && !criaCiclo(nos, no.empresa.id, pai.empresa.id)) pai.filhos.push(no)
    else raizes.push(no)
  }
  const ordenar = (lista: NoEmpresa[]) => {
    lista.sort((a, b) => a.empresa.nomeFantasia.localeCompare(b.empresa.nomeFantasia, 'pt-BR'))
    for (const n of lista) ordenar(n.filhos)
  }
  ordenar(raizes)
  fora.sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR'))
  return { raizes, fora }
}

function criaCiclo(nos: Map<string, NoEmpresa>, id: string, paiId: string) {
  let atual: string | null | undefined = paiId
  const vistos = new Set<string>()
  while (atual && !vistos.has(atual)) {
    if (atual === id) return true
    vistos.add(atual)
    atual = nos.get(atual)?.empresa.orgPaiId
  }
  return false
}

/** Ids de uma empresa e de todas abaixo dela (para não escolher um descendente como pai). */
export function idsAbaixo(empresas: Empresa[], id: string): Set<string> {
  const ids = new Set([id])
  let mudou = true
  while (mudou) {
    mudou = false
    for (const e of empresas) {
      if (e.orgPaiId && ids.has(e.orgPaiId) && !ids.has(e.id)) {
        ids.add(e.id)
        mudou = true
      }
    }
  }
  return ids
}

/** Empresas que podem ficar logo acima de uma do tipo informado. */
export function paisPossiveis(empresas: Empresa[], tipo: OrgTipo, excluirId?: string): Empresa[] {
  const bloqueados = excluirId ? idsAbaixo(empresas, excluirId) : new Set<string>()
  return empresas
    .filter((e) => e.orgTipo && PAIS_VALIDOS[tipo].includes(e.orgTipo) && !bloqueados.has(e.id))
    .sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR'))
}

export function contarNos(no: NoEmpresa): number {
  return 1 + no.filhos.reduce((soma, f) => soma + contarNos(f), 0)
}
