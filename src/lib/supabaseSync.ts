import { getSupabase } from './supabaseClient'
import { isSupabaseConfigured, loadSupabaseConfig } from './supabaseConfig'
import type {
  DocumentoRegistro,
  Empresa,
  Profissional,
  User,
} from './types'

const MAX_ARQUIVO_DADOS = 350_000

export type CloudBundle = {
  users: User[]
  empresas: Empresa[]
  profissionais: Profissional[]
  documentos: DocumentoRegistro[]
}

export async function supabaseConfigured(): Promise<boolean> {
  const cfg = await loadSupabaseConfig()
  return isSupabaseConfigured(cfg)
}

export function senhaParaHash(senha: string) {
  return `local:${senha}`
}

export function senhaDoHash(hash: string | null | undefined): string | null {
  if (!hash) return null
  if (hash.startsWith('local:')) return hash.slice('local:'.length)
  return null
}

function contaParaUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    senha: senhaDoHash(String(row.senha_hash ?? '')) ?? '',
    role: row.role as User['role'],
    usuario: row.usuario ? String(row.usuario) : undefined,
    nivelHierarquia: (row.nivel_hierarquia as User['nivelHierarquia']) || 'operador',
    superiorUsuario: (row.superior_usuario as string | null | undefined) ?? undefined,
    perfilCompleto: Boolean(row.perfil_completo),
    ativo: row.ativo !== false,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    aceites: (row.aceites as User['aceites']) ?? undefined,
  }
}

function profissionalDaLinha(row: Record<string, unknown>): Profissional {
  const payload = (row.payload as Partial<Profissional>) || {}
  const motivo =
    (row.motivo_recusa ? String(row.motivo_recusa) : '') ||
    (payload.motivoRecusa ? String(payload.motivoRecusa) : '') ||
    undefined
  return {
    ...(payload as Profissional),
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status as Profissional['status'],
    ...(motivo ? { motivoRecusa: motivo } : {}),
  }
}

function empresaDaLinha(row: Record<string, unknown>): Empresa {
  const payload = (row.payload as Partial<Empresa>) || {}
  const motivo =
    (row.motivo_recusa ? String(row.motivo_recusa) : '') ||
    (payload.motivoRecusa ? String(payload.motivoRecusa) : '') ||
    undefined
  return {
    ...(payload as Empresa),
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status as Empresa['status'],
    ...(motivo ? { motivoRecusa: motivo } : {}),
  }
}

function documentoDaLinha(row: Record<string, unknown>): DocumentoRegistro {
  return {
    id: String(row.id),
    tipoId: String(row.tipo_id),
    donoTipo: row.dono_tipo as DocumentoRegistro['donoTipo'],
    donoId: String(row.dono_id),
    status: row.status as DocumentoRegistro['status'],
    arquivoNome: row.arquivo_nome ? String(row.arquivo_nome) : undefined,
    arquivoDados: row.arquivo_dados ? String(row.arquivo_dados) : undefined,
    validade: row.validade ? String(row.validade) : undefined,
    enviadoEm: String(row.enviado_em ?? new Date().toISOString()),
    revisadoEm: row.revisado_em ? String(row.revisado_em) : undefined,
    revisadoPor: row.revisado_por ? String(row.revisado_por) : undefined,
    observacao: row.observacao ? String(row.observacao) : undefined,
    meta: (row.meta as Record<string, string> | undefined) ?? undefined,
  }
}

function perfilSemIds(profissional: Profissional) {
  const { id: _i, userId: _u, status: _s, ...resto } = profissional
  return resto
}

function empresaSemIds(empresa: Empresa) {
  const { id: _i, userId: _u, status: _s, ...resto } = empresa
  return resto
}

export async function pullCloudBundle(): Promise<CloudBundle | null> {
  const sb = await getSupabase()
  if (!sb) return null
  const [contas, profissionais, empresas, documentos] = await Promise.all([
    sb.from('mao_contas').select('*'),
    sb.from('mao_profissionais').select('*'),
    sb.from('mao_empresas').select('*'),
    sb.from('mao_documentos').select('*'),
  ])
  if (contas.error || profissionais.error || empresas.error || documentos.error) {
    console.warn(
      '[supabaseSync] falha ao puxar cadastros',
      contas.error?.message ||
        profissionais.error?.message ||
        empresas.error?.message ||
        documentos.error?.message,
    )
    return null
  }
  return {
    users: (contas.data || []).map((row) => contaParaUser(row as Record<string, unknown>)),
    profissionais: (profissionais.data || []).map((row) =>
      profissionalDaLinha(row as Record<string, unknown>),
    ),
    empresas: (empresas.data || []).map((row) => empresaDaLinha(row as Record<string, unknown>)),
    documentos: (documentos.data || []).map((row) => documentoDaLinha(row as Record<string, unknown>)),
  }
}

export async function emailExisteNaNuvem(email: string): Promise<boolean | null> {
  const sb = await getSupabase()
  if (!sb) return null
  const em = email.trim().toLowerCase()
  const { data, error } = await sb.from('mao_contas').select('id').ilike('email', em).limit(1)
  if (error) {
    console.warn('[supabaseSync] emailExiste', error.message)
    return null
  }
  return (data?.length ?? 0) > 0
}

export async function upsertConta(user: User): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Supabase não configurado.' }
  const { error } = await sb.from('mao_contas').upsert(
    {
      id: user.id,
      usuario: user.usuario ?? null,
      email: user.email.trim().toLowerCase(),
      senha_hash: senhaParaHash(user.senha),
      role: user.role,
      nivel_hierarquia: user.nivelHierarquia || 'operador',
      superior_usuario: user.superiorUsuario ?? null,
      perfil_completo: user.perfilCompleto !== false,
      ativo: user.ativo !== false,
      aceites: user.aceites ?? null,
      updated_at: new Date().toISOString(),
      created_at: user.createdAt || new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

export async function atualizarSenhaConta(
  email: string,
  novaSenha: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Supabase nao configurado.' }
  const { error } = await sb
    .from('mao_contas')
    .update({ senha_hash: senhaParaHash(novaSenha), updated_at: new Date().toISOString() })
    .ilike('email', email.trim().toLowerCase())
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

export async function upsertProfissional(
  profissional: Profissional,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Supabase nao configurado.' }
  const { error } = await sb.from('mao_profissionais').upsert(
    {
      id: profissional.id,
      user_id: profissional.userId,
      status: profissional.status,
      motivo_recusa: profissional.motivoRecusa ?? null,
      payload: perfilSemIds(profissional),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

export async function upsertEmpresa(empresa: Empresa): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Supabase nao configurado.' }
  const { error } = await sb.from('mao_empresas').upsert(
    {
      id: empresa.id,
      user_id: empresa.userId,
      status: empresa.status,
      motivo_recusa: empresa.motivoRecusa ?? null,
      payload: empresaSemIds(empresa),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

async function enviarArquivoStorage(
  donoTipo: string,
  donoId: string,
  docId: string,
  arquivoNome: string | undefined,
  arquivoDados: string | undefined,
): Promise<string | null> {
  if (!arquivoDados || !arquivoDados.startsWith('data:')) return null
  const sb = await getSupabase()
  if (!sb) return null
  const virgula = arquivoDados.indexOf(',')
  if (virgula < 0) return null
  const meta = arquivoDados.slice(0, virgula)
  const base64 = arquivoDados.slice(virgula + 1)
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'application/octet-stream'
  let bin: Uint8Array
  try {
    bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  } catch {
    return null
  }
  const ext =
    (arquivoNome && /\.([a-z0-9]+)$/i.exec(arquivoNome)?.[1]) ||
    (mime.includes('pdf') ? 'pdf' : mime.includes('png') ? 'png' : 'jpg')
  const path = `${donoTipo}/${donoId}/${docId}.${ext}`
  const { error } = await sb.storage.from('mao-documentos').upload(path, bin, {
    contentType: mime,
    upsert: true,
  })
  if (error) {
    console.warn('[supabaseSync] upload documento', error.message)
    return null
  }
  return path
}

export async function upsertDocumentos(
  docs: DocumentoRegistro[],
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Supabase nao configurado.' }
  if (!docs.length) return { ok: true }

  const rows = []
  for (const doc of docs) {
    let path = doc.meta?.storagePath || null
    if (doc.arquivoDados && doc.arquivoDados.length > 8_000) {
      path =
        (await enviarArquivoStorage(doc.donoTipo, doc.donoId, doc.id, doc.arquivoNome, doc.arquivoDados)) ||
        path
    }
    const inline =
      !path && doc.arquivoDados && doc.arquivoDados.length <= MAX_ARQUIVO_DADOS
        ? doc.arquivoDados
        : null
    rows.push({
      id: doc.id,
      tipo_id: doc.tipoId,
      dono_tipo: doc.donoTipo,
      dono_id: doc.donoId,
      status: doc.status,
      arquivo_nome: doc.arquivoNome ?? null,
      arquivo_path: path,
      arquivo_dados: inline,
      validade: doc.validade ?? null,
      enviado_em: doc.enviadoEm,
      revisado_em: doc.revisadoEm ?? null,
      revisado_por: doc.revisadoPor ?? null,
      observacao: doc.observacao ?? null,
      meta: {
        ...(doc.meta || {}),
        ...(path ? { storagePath: path } : {}),
        ...(doc.arquivoDados && !inline && !path ? { arquivoOmitido: 'grande' } : {}),
      },
      updated_at: new Date().toISOString(),
    })
  }

  const { error } = await sb.from('mao_documentos').upsert(rows, { onConflict: 'id' })
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

export async function setStatusProfissionalCloud(
  id: string,
  status: Profissional['status'],
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Supabase nao configurado.' }
  const { error } = await sb
    .from('mao_profissionais')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

export async function setStatusEmpresaCloud(
  id: string,
  status: Empresa['status'],
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Supabase nao configurado.' }
  const { error } = await sb
    .from('mao_empresas')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

export async function buscarContaLogin(
  usuarioOuEmail: string,
  senha: string,
): Promise<{ user: User; profissional?: Profissional; empresa?: Empresa } | null> {
  const sb = await getSupabase()
  if (!sb) return null
  const key = usuarioOuEmail.trim().toLowerCase()
  const { data, error } = await sb
    .from('mao_contas')
    .select('*')
    .or(`email.ilike.${key},usuario.ilike.${key}`)
    .eq('ativo', true)
    .limit(5)
  if (error || !data?.length) return null
  const row = data.find((item) => senhaDoHash(String(item.senha_hash)) === senha)
  if (!row) return null
  const user = contaParaUser(row as Record<string, unknown>)
  if (user.role === 'profissional') {
    const { data: prof } = await sb.from('mao_profissionais').select('*').eq('user_id', user.id).maybeSingle()
    return { user, profissional: prof ? profissionalDaLinha(prof as Record<string, unknown>) : undefined }
  }
  if (user.role === 'empresa') {
    const { data: emp } = await sb.from('mao_empresas').select('*').eq('user_id', user.id).maybeSingle()
    return { user, empresa: emp ? empresaDaLinha(emp as Record<string, unknown>) : undefined }
  }
  return { user }
}

export async function resolveEmailCloud(identificador: string): Promise<string | null> {
  const sb = await getSupabase()
  if (!sb) return null
  const key = identificador.trim().toLowerCase()
  const { data } = await sb
    .from('mao_contas')
    .select('email')
    .or(`email.ilike.${key},usuario.ilike.${key}`)
    .limit(1)
    .maybeSingle()
  return data?.email ? String(data.email) : null
}

/** Mescla cadastros da nuvem no estado local sem apagar seed/demo que ainda nao esta na nuvem. */
export function mesclarCloudNoEstado<
  T extends {
    users: User[]
    empresas: Empresa[]
    profissionais: Profissional[]
    documentos: DocumentoRegistro[]
  },
>(local: T, cloud: CloudBundle): T {
  const usersById = new Map(local.users.map((u) => [u.id, u]))
  const usersByEmail = new Map(local.users.map((u) => [u.email.toLowerCase(), u]))
  for (const remoto of cloud.users) {
    const porId = usersById.get(remoto.id)
    const porEmail = usersByEmail.get(remoto.email.toLowerCase())
    const alvo = porId || porEmail
    if (alvo) {
      const merged = {
        ...alvo,
        ...remoto,
        senha: remoto.senha || alvo.senha,
      }
      usersById.set(alvo.id, merged)
      usersById.set(remoto.id, merged)
    } else {
      usersById.set(remoto.id, remoto)
    }
  }

  const profById = new Map(local.profissionais.map((p) => [p.id, p]))
  for (const remoto of cloud.profissionais) {
    const atual = profById.get(remoto.id)
    profById.set(remoto.id, atual ? { ...atual, ...remoto } : remoto)
  }

  const empById = new Map(local.empresas.map((e) => [e.id, e]))
  for (const remoto of cloud.empresas) {
    const atual = empById.get(remoto.id)
    empById.set(remoto.id, atual ? { ...atual, ...remoto } : remoto)
  }

  const docById = new Map(local.documentos.map((d) => [d.id, d]))
  for (const remoto of cloud.documentos) {
    const atual = docById.get(remoto.id)
    docById.set(
      remoto.id,
      atual
        ? { ...atual, ...remoto, arquivoDados: remoto.arquivoDados || atual.arquivoDados }
        : remoto,
    )
  }

  return {
    ...local,
    users: Array.from(new Map([...usersById.values()].map((u) => [u.id, u])).values()),
    profissionais: Array.from(profById.values()),
    empresas: Array.from(empById.values()),
    documentos: Array.from(docById.values()),
  }
}


export async function excluirContaCloud(userId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Supabase nao configurado.' }

  const [{ data: profs }, { data: emps }] = await Promise.all([
    sb.from('mao_profissionais').select('id').eq('user_id', userId),
    sb.from('mao_empresas').select('id').eq('user_id', userId),
  ])
  const donoIds = [
    ...(profs || []).map((p) => String(p.id)),
    ...(emps || []).map((e) => String(e.id)),
  ]

  if (donoIds.length) {
    await sb.from('mao_documentos').delete().in('dono_id', donoIds)
    // limpa storage best-effort
    try {
      const paths: string[] = []
      for (const donoId of donoIds) {
        for (const pasta of ['profissional', 'empresa']) {
          const { data: files } = await sb.storage.from('mao-documentos').list(`${pasta}/${donoId}`)
          for (const f of files || []) {
            if (f.name) paths.push(`${pasta}/${donoId}/${f.name}`)
          }
        }
      }
      if (paths.length) await sb.storage.from('mao-documentos').remove(paths)
    } catch {
      /* ignore storage cleanup */
    }
  }

  await sb.from('mao_profissionais').delete().eq('user_id', userId)
  await sb.from('mao_empresas').delete().eq('user_id', userId)
  const { error } = await sb.from('mao_contas').delete().eq('id', userId)
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}
