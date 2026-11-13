/**
 * Sincronização do estado do app com o banco (modo real).
 *
 * Antes só contas, perfis e documentos do cadastro iam para o banco; vagas, candidaturas,
 * contratos, pagamentos, avaliações e as edições de perfil ficavam no navegador de quem fez.
 * A empresa publicava a vaga e o profissional, no celular dele, nunca via.
 *
 * Como funciona: guardamos a "base" — a última versão de cada item que sabemos estar no banco.
 *  - Ao puxar: item igual à base (sem mudança local) recebe a versão do banco; item diferente
 *    da base é mudança local pendente e fica; item que sumiu do banco e não mudou aqui sai.
 *  - Ao enviar: item diferente da base é gravado. Item que esta conta não pode alterar (de outra
 *    pessoa) não é enviado: a base passa a ser ele, e o próximo pull devolve a versão do banco.
 */
import type { AppState, DocumentoRegistro, Empresa, Profissional, User } from './types'
import { aplicarPermissoesDaNuvem, loadPermissoesMatriz } from './portalPermissoes'
import {
  apagarDocumentos,
  apagarRegistros,
  atualizarConta,
  upsertDocumentos,
  upsertEmpresa,
  upsertProfissional,
  upsertRegistros,
  type CloudBundle,
  type RegistroNuvem,
} from './supabaseSync'

export const COLECOES_REGISTRO = [
  'demandas',
  'candidaturas',
  'checkIns',
  'avaliacoes',
  'pagamentos',
  'contratos',
  'pecas',
  'infracoes',
  'sinistros',
  'operacoes',
  'perfisIdeais',
  'enderecosEmpresa',
  'veiculos',
  'relatorios',
  'modelosVaga',
] as const

type ColecaoRegistro = (typeof COLECOES_REGISTRO)[number]
type Item = { id: string } & Record<string, unknown>

const base = new Map<string, string>()

/** Ao sair da conta: nada do usuário anterior pode servir de referência para o próximo. */
export function zerarBase() {
  base.clear()
}

// ---------- Assinaturas (o que conta como "mudou") ----------

function assinaturaConta(u: User) {
  return JSON.stringify([
    u.usuario ?? null,
    u.perfilCompleto !== false,
    u.aceites ?? null,
    u.nivelHierarquia || 'operador',
    u.superiorUsuario ?? null,
    u.ativo !== false,
    u.role,
  ])
}

/** Nível, nota, saldo e ganhos são calculados (avaliações/pagamentos): não contam como mudança. */
function assinaturaProfissional(p: Profissional) {
  const { nivel: _n, avaliacaoMedia: _a, saldo: _s, ganhosMes: _g, ...resto } = p
  return JSON.stringify(resto)
}

function assinaturaEmpresa(e: Empresa) {
  const { avaliacaoMedia: _a, ...resto } = e
  return JSON.stringify(resto)
}

/** O conteúdo do arquivo fica fora: o banco devolve só o caminho no Storage. */
function assinaturaDocumento(d: DocumentoRegistro) {
  const { arquivoDados: _d, meta, ...resto } = d
  const { versoDados: _v, storagePath: _p, arquivoOmitido: _o, ...metaResto } = meta || {}
  return JSON.stringify([resto, metaResto])
}

function assinaturaItem(item: unknown) {
  return JSON.stringify(item)
}

// ---------- Mescla genérica ----------

function mesclarLista<T extends { id: string }>(
  ref: ReadonlyMap<string, string>,
  tipo: string,
  locais: T[],
  remotos: T[],
  assinatura: (x: T) => string,
  combinar?: (local: T, remoto: T) => T,
): T[] {
  const remotosPorId = new Map(remotos.map((r) => [r.id, r]))
  const vistos = new Set<string>()
  const saida: T[] = []
  for (const local of locais) {
    const chave = `${tipo}:${local.id}`
    const remoto = remotosPorId.get(local.id)
    const referencia = ref.get(chave)
    const pendente = referencia !== undefined && assinatura(local) !== referencia
    if (remoto) {
      vistos.add(local.id)
      if (pendente) {
        saida.push(local)
      } else {
        saida.push(combinar ? combinar(local, remoto) : remoto)
        base.set(chave, assinatura(remoto))
      }
      continue
    }
    if (referencia !== undefined && !pendente) {
      // Estava no banco e sumiu (apagado ou sem acesso): sai daqui também.
      base.delete(chave)
      continue
    }
    saida.push(local)
  }
  for (const remoto of remotos) {
    if (vistos.has(remoto.id)) continue
    // Já sincronizado e removido aqui: exclusão pendente (o envio apaga no banco).
    if (ref.has(`${tipo}:${remoto.id}`)) continue
    saida.push(remoto)
    base.set(`${tipo}:${remoto.id}`, assinatura(remoto))
  }
  return saida
}

/** Ids que estavam sincronizados e não existem mais na lista local. */
function removidosDe(tipo: string, lista: { id: string }[]) {
  const presentes = new Set(lista.map((i) => i.id))
  const removidos: string[] = []
  for (const chave of base.keys()) {
    if (!chave.startsWith(`${tipo}:`)) continue
    const id = chave.slice(tipo.length + 1)
    if (!presentes.has(id)) removidos.push(id)
  }
  return removidos
}

function registrosDaColecao(cloud: CloudBundle, colecao: string): Item[] {
  return cloud.registros
    .filter((r) => r.colecao === colecao && r.payload && typeof r.payload === 'object')
    .map((r) => ({ ...(r.payload as Record<string, unknown>), id: r.id }) as Item)
}

/** Cópia da base para decidir a mescla (o React pode rodar a atualização duas vezes). */
export function fotografarBase(): ReadonlyMap<string, string> {
  return new Map(base)
}

export function mesclarNuvem(local: AppState, cloud: CloudBundle, ref: ReadonlyMap<string, string> = fotografarBase()): AppState {
  const next: AppState = {
    ...local,
    users: mesclarLista(ref, 'contas', local.users, cloud.users, assinaturaConta, (l, r) => ({ ...r, senha: l.senha })),
    profissionais: mesclarLista(ref, 'profissionais', local.profissionais, cloud.profissionais, assinaturaProfissional),
    empresas: mesclarLista(ref, 'empresas', local.empresas, cloud.empresas, assinaturaEmpresa),
    documentos: mesclarLista(ref, 'documentos', local.documentos, cloud.documentos, assinaturaDocumento, (l, r) => ({
      ...r,
      arquivoDados: r.arquivoDados || l.arquivoDados,
      meta: r.meta?.versoDados || !l.meta?.versoDados ? r.meta : { ...(r.meta || {}), versoDados: l.meta.versoDados },
    })),
  }
  const mutavel = next as unknown as Record<string, Item[]>
  const origem = local as unknown as Record<string, Item[]>
  for (const colecao of COLECOES_REGISTRO) {
    mutavel[colecao] = mesclarLista(ref, colecao, origem[colecao] ?? [], registrosDaColecao(cloud, colecao), assinaturaItem)
  }
  const perms = cloud.registros.find((r) => r.colecao === 'config' && r.id === 'permissoes')
  if (perms) {
    const chave = 'config:permissoes'
    const referencia = ref.get(chave)
    const localSig = assinaturaItem(loadPermissoesMatriz())
    if (referencia === undefined || referencia === localSig) {
      aplicarPermissoesDaNuvem(perms.payload as Parameters<typeof aplicarPermissoesDaNuvem>[0])
      base.set(chave, assinaturaItem(loadPermissoesMatriz()))
    }
  }
  const grupos = cloud.registros.find((r) => r.colecao === 'config' && r.id === 'gruposHierarquia')
  if (grupos) {
    const chave = 'config:gruposHierarquia'
    const referencia = ref.get(chave)
    if (referencia === undefined || referencia === assinaturaItem(local.gruposHierarquia ?? [])) {
      const lista = (grupos.payload as { grupos?: unknown }).grupos
      next.gruposHierarquia = Array.isArray(lista) ? (lista as AppState['gruposHierarquia']) : []
      base.set(chave, assinaturaItem(next.gruposHierarquia ?? []))
    }
  }
  const ett = cloud.registros.find((r) => r.colecao === 'config' && r.id === 'cadastroEtt')
  if (ett) {
    const chave = 'config:cadastroEtt'
    const assinaturaLocal = assinaturaItem(local.cadastroEtt)
    const referencia = ref.get(chave)
    if (referencia === undefined || referencia === assinaturaLocal) {
      next.cadastroEtt = ett.payload as unknown as AppState['cadastroEtt']
      base.set(chave, assinaturaItem(next.cadastroEtt))
    }
  }
  return next
}

// ---------- Envio ----------

export type Eu = {
  userId: string
  admin: boolean
  empresaIds: Set<string>
  profissionalIds: Set<string>
}

export function quemSouEu(state: AppState): Eu | null {
  const user = state.users.find((u) => u.id === state.sessionUserId)
  if (!user) return null
  return {
    userId: user.id,
    admin: user.role === 'admin' || user.role === 'super',
    empresaIds: new Set(state.empresas.filter((e) => e.userId === user.id).map((e) => e.id)),
    profissionalIds: new Set(state.profissionais.filter((p) => p.userId === user.id).map((p) => p.id)),
  }
}

function demandaDe(state: AppState, demandaId: unknown) {
  return state.demandas.find((d) => d.id === demandaId)
}

/** A quem o item pertence (define quem vê e quem altera no banco). */
export function donosDoItem(
  colecao: ColecaoRegistro,
  item: Item,
  state: AppState,
): { empresaId: string | null; profissionalId: string | null; publico: boolean } {
  const texto = (v: unknown) => (typeof v === 'string' && v ? v : null)
  switch (colecao) {
    case 'demandas':
      return { empresaId: texto(item.empresaId), profissionalId: null, publico: true }
    case 'candidaturas':
    case 'checkIns':
      return {
        empresaId: texto(demandaDe(state, item.demandaId)?.empresaId),
        profissionalId: texto(item.profissionalId),
        publico: false,
      }
    case 'avaliacoes': {
      const demanda = demandaDe(state, item.demandaId)
      const usuarios = [item.deUserId, item.paraUserId]
      const prof = state.profissionais.find((p) => usuarios.includes(p.userId))
      const emp = state.empresas.find((e) => usuarios.includes(e.userId))
      return {
        empresaId: texto(demanda?.empresaId) ?? texto(emp?.id),
        profissionalId: texto(prof?.id),
        publico: false,
      }
    }
    case 'pagamentos':
    case 'contratos':
    case 'pecas':
      return { empresaId: texto(item.empresaId), profissionalId: texto(item.profissionalId), publico: false }
    default:
      return { empresaId: texto(item.empresaId), profissionalId: null, publico: false }
  }
}

function podeEscreverRegistro(eu: Eu, d: { empresaId: string | null; profissionalId: string | null }) {
  return (
    eu.admin ||
    (d.empresaId !== null && eu.empresaIds.has(d.empresaId)) ||
    (d.profissionalId !== null && eu.profissionalIds.has(d.profissionalId))
  )
}

function donoDoDocumento(eu: Eu, d: DocumentoRegistro) {
  if (eu.admin) return true
  if (d.donoTipo === 'empresa') return eu.empresaIds.has(d.donoId)
  if (d.donoTipo === 'profissional') return eu.profissionalIds.has(d.donoId)
  return false
}

type Pendente<T> = { chave: string; assinatura: string; item: T }

function pendentesDe<T extends { id: string }>(
  tipo: string,
  lista: T[],
  assinatura: (x: T) => string,
  pode: (x: T) => boolean,
): Pendente<T>[] {
  const saida: Pendente<T>[] = []
  for (const item of lista) {
    const chave = `${tipo}:${item.id}`
    const sig = assinatura(item)
    if (base.get(chave) === sig) continue
    if (!pode(item)) {
      // Mudança em item de outra pessoa: o banco recusaria. Vira base para o pull desfazer.
      base.set(chave, sig)
      continue
    }
    saida.push({ chave, assinatura: sig, item })
  }
  return saida
}

let enviando: Promise<string[]> | null = null

/**
 * Envia o que mudou. Devolve os erros (para log); itens que falham não são reenviados em loop:
 * passam a ser base e o próximo pull traz a versão do banco.
 */
export function enviarMudancas(state: AppState): Promise<string[]> {
  if (enviando) return enviando.then(() => enviarMudancas(state))
  enviando = enviarAgora(state).finally(() => {
    enviando = null
  })
  return enviando
}

async function enviarAgora(state: AppState): Promise<string[]> {
  const eu = quemSouEu(state)
  if (!eu) return []
  const erros: string[] = []
  const confirmar = (p: Pendente<unknown>) => base.set(p.chave, p.assinatura)

  for (const p of pendentesDe('contas', state.users, assinaturaConta, (u) => eu.admin || u.id === eu.userId)) {
    const r = await atualizarConta(p.item)
    if (!r.ok) erros.push(r.erro)
    confirmar(p)
  }
  for (const p of pendentesDe(
    'empresas',
    state.empresas,
    assinaturaEmpresa,
    (e) => eu.admin || e.userId === eu.userId,
  )) {
    const r = await upsertEmpresa(p.item)
    if (!r.ok) erros.push(r.erro)
    confirmar(p)
  }
  for (const p of pendentesDe(
    'profissionais',
    state.profissionais,
    assinaturaProfissional,
    (x) => eu.admin || x.userId === eu.userId,
  )) {
    const r = await upsertProfissional(p.item)
    if (!r.ok) erros.push(r.erro)
    confirmar(p)
  }
  const docs = pendentesDe('documentos', state.documentos, assinaturaDocumento, (d) => donoDoDocumento(eu, d))
  if (docs.length) {
    const r = await upsertDocumentos(docs.map((p) => p.item))
    if (!r.ok) erros.push(r.erro)
    docs.forEach(confirmar)
  }
  // Documento trocado (o novo ganha outro id) ou removido aqui: sai do banco também.
  const docsRemovidos = removidosDe('documentos', state.documentos)
  if (docsRemovidos.length) {
    const r = await apagarDocumentos(docsRemovidos)
    if (!r.ok) erros.push(r.erro)
    docsRemovidos.forEach((id) => base.delete(`documentos:${id}`))
  }
  // Contas e perfis só são apagados pelo admin (excluirUsuario já apaga no banco).
  for (const tipo of ['contas', 'profissionais', 'empresas'] as const) {
    const lista = tipo === 'contas' ? state.users : tipo === 'profissionais' ? state.profissionais : state.empresas
    for (const id of removidosDe(tipo, lista)) base.delete(`${tipo}:${id}`)
  }

  const fonte = state as unknown as Record<string, Item[]>
  for (const colecao of COLECOES_REGISTRO) {
    const lista = fonte[colecao] ?? []
    const linhas = new Map<string, RegistroNuvem>()
    const pend = pendentesDe(colecao, lista, assinaturaItem, (item) => {
      const d = donosDoItem(colecao, item, state)
      if (!podeEscreverRegistro(eu, d)) return false
      linhas.set(item.id, {
        colecao,
        id: item.id,
        empresa_id: d.empresaId,
        profissional_id: d.profissionalId,
        publico: d.publico,
        payload: item,
      })
      return true
    })
    if (pend.length) {
      const lote = await upsertRegistros(pend.map((p) => linhas.get(p.item.id)!))
      if (!lote.ok) {
        // Um item recusado derruba o lote inteiro: tenta um a um.
        for (const p of pend) {
          const r = await upsertRegistros([linhas.get(p.item.id)!])
          if (!r.ok) erros.push(`${colecao}: ${r.erro}`)
        }
      }
      pend.forEach(confirmar)
    }
    // Itens que estavam no banco e foram removidos aqui.
    const removidos = removidosDe(colecao, lista)
    if (removidos.length) {
      const r = await apagarRegistros(colecao, removidos)
      if (!r.ok) erros.push(`${colecao}: ${r.erro}`)
      removidos.forEach((id) => base.delete(`${colecao}:${id}`))
    }
  }

  if (eu.admin) {
    const matriz = loadPermissoesMatriz()
    const sigPerms = assinaturaItem(matriz)
    if (base.get('config:permissoes') !== sigPerms && Object.keys(matriz).length) {
      const r = await upsertRegistros([
        { colecao: 'config', id: 'permissoes', empresa_id: null, profissional_id: null, publico: true, payload: matriz },
      ])
      if (!r.ok) erros.push(`permissões: ${r.erro}`)
      base.set('config:permissoes', sigPerms)
    }
  }

  if (eu.admin) {
    // Grupos de hierarquia: registro de configuração sem "publico", então só a gestão lê.
    const chave = 'config:gruposHierarquia'
    const lista = state.gruposHierarquia ?? []
    const sig = assinaturaItem(lista)
    if (base.get(chave) !== sig && (lista.length || base.get(chave) !== undefined)) {
      const r = await upsertRegistros([
        {
          colecao: 'config',
          id: 'gruposHierarquia',
          empresa_id: null,
          profissional_id: null,
          publico: false,
          payload: { grupos: lista } as unknown as Record<string, unknown>,
        },
      ])
      if (!r.ok) erros.push(`grupos de hierarquia: ${r.erro}`)
      else base.set(chave, sig)
    }
  }

  if (eu.admin) {
    const chave = 'config:cadastroEtt'
    const sig = assinaturaItem(state.cadastroEtt)
    if (base.get(chave) !== sig) {
      const r = await upsertRegistros([
        {
          colecao: 'config',
          id: 'cadastroEtt',
          empresa_id: null,
          profissional_id: null,
          publico: true,
          payload: state.cadastroEtt as unknown as Record<string, unknown>,
        },
      ])
      if (!r.ok) erros.push(`cadastroEtt: ${r.erro}`)
      base.set(chave, sig)
    }
  }
  return erros
}

/** Depois de gravar algo diretamente (cadastro, aprovação), registra como já sincronizado. */
export function marcarComoSincronizado(state: AppState) {
  for (const u of state.users) base.set(`contas:${u.id}`, assinaturaConta(u))
  for (const p of state.profissionais) base.set(`profissionais:${p.id}`, assinaturaProfissional(p))
  for (const e of state.empresas) base.set(`empresas:${e.id}`, assinaturaEmpresa(e))
}
