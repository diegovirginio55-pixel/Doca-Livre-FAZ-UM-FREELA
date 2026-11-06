import { chamarApi } from './api'
import { getSupabase } from './supabaseClient'
import { isSupabaseConfigured, loadSupabaseConfig } from './supabaseConfig'
import { emDemo } from './modo'
import { tokenAtual } from './sessao'
import type { DocumentoRegistro, Empresa, Profissional, User } from './types'

const MAX_ARQUIVO_DADOS = 350_000

export type RegistroNuvem = {
  colecao: string
  id: string
  empresa_id: string | null
  profissional_id: string | null
  publico: boolean
  payload: Record<string, unknown>
}

export type CloudBundle = {
  users: User[]
  empresas: Empresa[]
  profissionais: Profissional[]
  documentos: DocumentoRegistro[]
  registros: RegistroNuvem[]
}

/** Há banco e sessão: só então vale ler/gravar (no modo demo, nunca). */
export async function supabaseConfigured(): Promise<boolean> {
  if (emDemo()) return false
  const cfg = await loadSupabaseConfig()
  return isSupabaseConfigured(cfg)
}

/** Troca o erro cru do banco (ex.: chave única violada) por uma frase que o usuário entende. */
function erroAmigavel(error: { code?: string; message?: string; details?: string }): string {
  const texto = `${error.message || ''} ${error.details || ''}`.toLowerCase()
  if (error.code === '23505' || texto.includes('duplicate key')) {
    if (texto.includes('usuario')) return 'Nome de usuário já existe.'
    if (texto.includes('email')) return 'Este e-mail já está sendo utilizado.'
    return 'Este cadastro já existe.'
  }
  if (error.code === '42501' || texto.includes('row-level security') || texto.includes('permission denied')) {
    return 'Sem permissão para salvar isso.'
  }
  if (error.code === 'PGRST301' || texto.includes('jwt expired')) return 'Sua sessão expirou. Entre de novo.'
  return error.message || 'Não foi possível salvar. Tente de novo em instantes.'
}

function contaParaUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    // A senha nunca sai do servidor.
    senha: '',
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

/** Conta que a API devolve no login (já em camelCase). */
export function contaDaApi(conta: Record<string, unknown>): User {
  return {
    id: String(conta.id),
    email: String(conta.email),
    senha: '',
    role: conta.role as User['role'],
    usuario: conta.usuario ? String(conta.usuario) : undefined,
    nivelHierarquia: (conta.nivelHierarquia as User['nivelHierarquia']) || 'operador',
    superiorUsuario: (conta.superiorUsuario as string | null | undefined) ?? undefined,
    perfilCompleto: Boolean(conta.perfilCompleto),
    ativo: conta.ativo !== false,
    createdAt: String(conta.createdAt || new Date().toISOString()),
    aceites: (conta.aceites as User['aceites']) ?? undefined,
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
    // Linha incompleta no banco não pode derrubar as telas que leem esses campos.
    profissoes: Array.isArray(payload.profissoes) ? payload.profissoes : [],
    experiencia: Array.isArray(payload.experiencia) ? payload.experiencia : [],
    certificados: Array.isArray(payload.certificados) ? payload.certificados : [],
    endereco: payload.endereco ?? { cep: '', rua: '', numero: '', cidade: '', estado: '', lat: NaN, lng: NaN },
    disponibilidade: payload.disponibilidade ?? ({} as Profissional['disponibilidade']),
    avaliacaoMedia: Number(payload.avaliacaoMedia ?? 5),
    nivel: payload.nivel ?? 'bronze',
    saldo: Number(payload.saldo ?? 0),
    ganhosMes: Number(payload.ganhosMes ?? 0),
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status as Profissional['status'],
    motivoRecusa: motivo,
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
    endereco: payload.endereco ?? { cep: '', rua: '', numero: '', cidade: '', estado: '', lat: NaN, lng: NaN },
    favoritos: Array.isArray(payload.favoritos) ? payload.favoritos : [],
    bloqueados: Array.isArray(payload.bloqueados) ? payload.bloqueados : [],
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status as Empresa['status'],
    motivoRecusa: motivo,
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

export type ResultadoPull = CloudBundle | 'sessao_expirada' | null

/** Tudo o que esta conta pode ver. Sem sessão não há o que ler (o banco não responde a anônimos). */
export async function pullCloudBundle(): Promise<ResultadoPull> {
  if (!tokenAtual()) return null
  const sb = await getSupabase()
  if (!sb) return null
  const [contas, profissionais, empresas, documentos, registros] = await Promise.all([
    sb.from('mao_contas').select('*'),
    sb.from('mao_profissionais').select('*'),
    sb.from('mao_empresas').select('*'),
    sb.from('mao_documentos').select('*'),
    sb.from('mao_registros').select('colecao, id, empresa_id, profissional_id, publico, payload'),
  ])
  const erro = contas.error || profissionais.error || empresas.error || documentos.error || registros.error
  if (erro) {
    if (erro.code === 'PGRST301' || /jwt/i.test(erro.message || '')) return 'sessao_expirada'
    console.warn('[supabaseSync] falha ao puxar dados', erro.message)
    return null
  }
  return {
    users: (contas.data || []).map((row) => contaParaUser(row as Record<string, unknown>)),
    profissionais: (profissionais.data || []).map((row) => profissionalDaLinha(row as Record<string, unknown>)),
    empresas: (empresas.data || []).map((row) => empresaDaLinha(row as Record<string, unknown>)),
    documentos: (documentos.data || []).map((row) => documentoDaLinha(row as Record<string, unknown>)),
    registros: (registros.data || []) as RegistroNuvem[],
  }
}

/** E-mail/usuário já cadastrados (a tabela de contas não é mais legível para quem não é dono). */
export async function emailExisteNaNuvem(email: string): Promise<boolean | null> {
  if (emDemo()) return null
  const res = await chamarApi<{ email: boolean }>('/api/auth/existe', { email: email.trim().toLowerCase() })
  return res.ok ? Boolean(res.email) : null
}

export async function usuarioExisteNaNuvem(usuario: string): Promise<boolean | null> {
  if (emDemo()) return null
  const res = await chamarApi<{ usuario: boolean }>('/api/auth/existe', { usuario: usuario.trim() })
  return res.ok ? Boolean(res.usuario) : null
}

/** Atualiza a própria conta (ou qualquer uma, se admin). Contas novas só nascem pela API. */
export async function atualizarConta(user: User): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Banco não configurado.' }
  const { error } = await sb
    .from('mao_contas')
    .update({
      usuario: user.usuario ?? null,
      perfil_completo: user.perfilCompleto !== false,
      aceites: user.aceites ?? null,
      nivel_hierarquia: user.nivelHierarquia || 'operador',
      superior_usuario: user.superiorUsuario ?? null,
      ativo: user.ativo !== false,
      role: user.role,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) return { ok: false, erro: erroAmigavel(error) }
  return { ok: true }
}

export async function upsertProfissional(
  profissional: Profissional,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Banco não configurado.' }
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
  if (error) return { ok: false, erro: erroAmigavel(error) }
  return { ok: true }
}

export async function upsertEmpresa(empresa: Empresa): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Banco não configurado.' }
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
  if (error) return { ok: false, erro: erroAmigavel(error) }
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
  // A extensão segue o conteúdo real: o PDF do cadastro costuma virar JPEG antes do envio,
  // e um "contrato.pdf" salvo como .pdf com imagem dentro não abria a prévia no admin.
  const porMime: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  const ext = porMime[mime] || (arquivoNome && /\.([a-z0-9]+)$/i.exec(arquivoNome)?.[1]) || 'bin'
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
  opts?: { exigirArquivo?: boolean },
): Promise<{ ok: true; docs: DocumentoRegistro[] } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Banco não configurado.' }
  if (!docs.length) return { ok: true, docs }

  const rows = []
  const salvos: DocumentoRegistro[] = []
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
    if (opts?.exigirArquivo && doc.arquivoDados && !path && !inline) {
      // Sem isso o cadastro seguia "concluído" com o documento perdido e o admin não tinha o que validar.
      return {
        ok: false,
        erro: `Não foi possível enviar o arquivo "${doc.arquivoNome || 'documento'}". Confira a internet e tente de novo.`,
      }
    }
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
    salvos.push(path ? { ...doc, meta: { ...(doc.meta || {}), storagePath: path } } : doc)
  }

  const { error } = await sb.from('mao_documentos').upsert(rows, { onConflict: 'id' })
  if (error) return { ok: false, erro: erroAmigavel(error) }
  return { ok: true, docs: salvos }
}

/** Grava (ou apaga) itens de vagas, candidaturas, contratos etc. na tabela única de registros. */
export async function upsertRegistros(rows: RegistroNuvem[]): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Banco não configurado.' }
  if (!rows.length) return { ok: true }
  const { error } = await sb.from('mao_registros').upsert(rows, { onConflict: 'colecao,id' })
  if (error) return { ok: false, erro: erroAmigavel(error) }
  return { ok: true }
}

export async function apagarDocumentos(ids: string[]): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Banco não configurado.' }
  if (!ids.length) return { ok: true }
  const { error } = await sb.from('mao_documentos').delete().in('id', ids)
  if (error) return { ok: false, erro: erroAmigavel(error) }
  return { ok: true }
}

export async function apagarRegistros(colecao: string, ids: string[]): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Banco não configurado.' }
  if (!ids.length) return { ok: true }
  const { error } = await sb.from('mao_registros').delete().eq('colecao', colecao).in('id', ids)
  if (error) return { ok: false, erro: erroAmigavel(error) }
  return { ok: true }
}

export async function excluirContaCloud(userId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, erro: 'Banco não configurado.' }

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

  // Perfis, documentos e credenciais saem junto (on delete cascade no banco).
  const { error } = await sb.from('mao_contas').delete().eq('id', userId)
  if (error) return { ok: false, erro: erroAmigavel(error) }
  return { ok: true }
}
