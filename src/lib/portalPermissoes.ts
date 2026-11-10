/** Contas super do painel. O colaborador Diego Isidoro não entra nesta lista. */
export function isLocalSuperUser(usuario: string): boolean {
  const u = (usuario || '').trim().toLowerCase()
  if (!u) return false
  const ascii = u.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const locals = ['diego', 'elder', 'elder.tenorio', 'eldertenorio', 'elder tenorio']
  if (locals.includes(ascii)) return true
  const local = (ascii.split('@')[0] || '').trim()
  return locals.includes(local)
}

export type SistemaId = 'empresa' | 'profissional' | 'admin'

export type NivelHierarquia = 'super' | 'gestor' | 'operador'

export type ModuloAcesso = 'editar' | 'visualizar' | 'oculto'

export type SistemaPermissao = {
  pode_acessar: boolean
  modulos: Record<string, ModuloAcesso> | null
}

export const MODULOS_POR_SISTEMA: Record<SistemaId, { id: string; label: string }[]> = {
  empresa: [
    { id: 'inicio', label: 'Início' },
    { id: 'operacional', label: 'Operacional' },
    { id: 'documentacao', label: 'Documentação' },
    { id: 'ocorrencias', label: 'Ocorrências' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'relatorios', label: 'Relatórios' },
    { id: 'modelos', label: 'Modelos' },
    { id: 'contratos', label: 'Contratos' },
    { id: 'prestadores', label: 'Prestadores' },
  ],
  profissional: [
    { id: 'vagas', label: 'Vagas' },
    { id: 'agenda', label: 'Vagas aceitas' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'perfil', label: 'Perfil' },
    { id: 'opcoes', label: 'Opções' },
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'empresas', label: 'Empresas' },
    { id: 'profissionais', label: 'Profissionais' },
    { id: 'documentacao', label: 'Documentação' },
    { id: 'demandas', label: 'Demandas' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'auditoria', label: 'Auditoria' },
    { id: 'config', label: 'Hierarquia e permissões' },
  ],
}

export const SISTEMA_LABEL: Record<SistemaId, string> = {
  empresa: 'Portal Empresa',
  profissional: 'Portal Profissional',
  admin: 'Painel Admin',
}

const PERMS_KEY = 'mao-portal-permissoes-v1'
const HIER_KEY = 'mao-portal-hierarquia-v1'

export type HierarquiaUsuario = {
  usuario: string
  nivel: NivelHierarquia
  superior_usuario: string | null
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadPermissoesMatriz(): Record<string, Record<SistemaId, SistemaPermissao>> {
  return loadJson(PERMS_KEY, {})
}

/**
 * Matriz vinda do banco (config compartilhada). Antes as permissões ficavam só no navegador de
 * quem configurou e não valiam em nenhum outro aparelho.
 */
export function aplicarPermissoesDaNuvem(matriz: Record<string, Record<SistemaId, SistemaPermissao>>) {
  try {
    saveJson(PERMS_KEY, matriz && typeof matriz === 'object' ? matriz : {})
  } catch {
    /* ignore */
  }
}

export function savePermissoesUsuario(
  usuario: string,
  matriz: Record<SistemaId, SistemaPermissao>,
) {
  const all = loadPermissoesMatriz()
  all[usuario] = matriz
  saveJson(PERMS_KEY, all)
}

export function loadHierarquia(): HierarquiaUsuario[] {
  return loadJson(HIER_KEY, [])
}

export function saveHierarquiaUsuario(row: HierarquiaUsuario) {
  const list = loadHierarquia().filter((h) => h.usuario !== row.usuario)
  list.push(row)
  saveJson(HIER_KEY, list)
}

export function fullAccessMatriz(): Record<SistemaId, SistemaPermissao> {
  return {
    empresa: { pode_acessar: true, modulos: null },
    profissional: { pode_acessar: true, modulos: null },
    admin: { pode_acessar: true, modulos: null },
  }
}

export function defaultMatrizForRole(role: SistemaId | 'super'): Record<SistemaId, SistemaPermissao> {
  if (role === 'super') return fullAccessMatriz()
  return {
    empresa: { pode_acessar: role === 'empresa', modulos: null },
    profissional: { pode_acessar: role === 'profissional', modulos: null },
    admin: { pode_acessar: role === 'admin', modulos: null },
  }
}

export function getPermissoesUsuario(
  usuario: string,
  email?: string,
  role?: string,
): Record<SistemaId, SistemaPermissao> {
  if (isLocalSuperUser(usuario) || isLocalSuperUser(email || '')) {
    return fullAccessMatriz()
  }
  const saved = loadPermissoesMatriz()[usuario]
  if (saved) return saved
  if (role === 'admin' || role === 'super') return fullAccessMatriz()
  if (role === 'empresa' || role === 'profissional') {
    return defaultMatrizForRole(role)
  }
  return {
    empresa: { pode_acessar: false, modulos: null },
    profissional: { pode_acessar: false, modulos: null },
    admin: { pode_acessar: false, modulos: null },
  }
}

export function canAccessSistema(
  usuario: string,
  sistema: SistemaId,
  email?: string,
  role?: string,
): boolean {
  const m = getPermissoesUsuario(usuario, email, role)
  return m[sistema]?.pode_acessar !== false
}

export function normalizeModulosMap(
  modulos: string[] | Record<string, ModuloAcesso> | null | undefined,
): Record<string, ModuloAcesso> | null {
  if (modulos == null) return null
  if (Array.isArray(modulos)) {
    const out: Record<string, ModuloAcesso> = {}
    for (const id of modulos) out[id] = 'editar'
    return out
  }
  return modulos
}

export function moduloPermitido(
  usuario: string,
  sistema: SistemaId,
  moduloId: string,
  email?: string,
  role?: string,
): ModuloAcesso {
  if (isLocalSuperUser(usuario) || isLocalSuperUser(email || '')) return 'editar'
  const m = getPermissoesUsuario(usuario, email, role)[sistema]
  if (!m || m.pode_acessar === false) return 'oculto'
  if (m.modulos == null) return 'editar'
  return m.modulos[moduloId] ?? 'oculto'
}
