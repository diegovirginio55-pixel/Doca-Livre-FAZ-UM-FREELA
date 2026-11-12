// Login, criação de conta e senhas — tudo no servidor.
// Antes o navegador baixava as contas (com a senha em texto puro) e comparava a senha ele mesmo.
import {
  assinarToken,
  conferirSenha,
  gerarHashSenha,
  lerToken,
  problemaSenha,
  senhaTemporaria,
  tokenDoPedido,
} from './auth.mjs'
import { enviarEmail } from './email.mjs'
import { pool } from './migrar.mjs'
import { consumirTokenVerificado } from './server-functions/enviarCodigoEmail.mjs'
import { montarEmailContaCriada } from './server-functions/notificarCadastro.mjs'

const COLUNAS_CONTA =
  'id, usuario, email, role, nivel_hierarquia, superior_usuario, perfil_completo, ativo, aceites, created_at'

function ehGestao(role) {
  return role === 'admin' || role === 'super'
}

/** Regra de senha: forte (10+, maiúscula, minúscula, número) para admin/super; 8+ com letra e número para os demais. */
export function problemaSenhaConta(senha, role) {
  if (ehGestao(role)) return problemaSenha(senha)
  const s = String(senha || '')
  if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (s.length > 128) return 'A senha pode ter no máximo 128 caracteres.'
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return 'Use letras e números na senha.'
  if (/^(.)\1+$/.test(s) || /(12345678|password|senha123)/i.test(s)) return 'Essa senha é fácil de adivinhar. Escolha outra.'
  return ''
}

function contaPublica(row) {
  return {
    id: row.id,
    usuario: row.usuario,
    email: row.email,
    role: row.role,
    nivelHierarquia: row.nivel_hierarquia,
    superiorUsuario: row.superior_usuario,
    perfilCompleto: row.perfil_completo,
    ativo: row.ativo,
    aceites: row.aceites ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ''),
  }
}

function sessao(row, trocarSenha) {
  const { token, expira } = assinarToken(row, { restrito: Boolean(trocarSenha) })
  return { ok: true, status: 200, token, expira, conta: contaPublica(row), trocarSenha: Boolean(trocarSenha) }
}

// ---------- Limite de tentativas de login (por réplica) ----------
const falhas = new Map()
const JANELA_MS = 15 * 60 * 1000
const MAX_FALHAS = 8

function bloqueado(chave) {
  const reg = falhas.get(chave)
  if (!reg) return false
  if (Date.now() - reg.inicio > JANELA_MS) {
    falhas.delete(chave)
    return false
  }
  return reg.n >= MAX_FALHAS
}

function registrarFalha(chave) {
  const reg = falhas.get(chave)
  if (!reg || Date.now() - reg.inicio > JANELA_MS) falhas.set(chave, { n: 1, inicio: Date.now() })
  else reg.n += 1
  if (falhas.size > 5000) falhas.clear()
}

/**
 * Conta ativa dona do token do pedido, lida do banco (papel e "ativo" sempre atualizados).
 * Token restrito (troca de senha pendente) só vale com `permitirTroca`.
 */
export async function contaDoPedido(req, { permitirTroca = false } = {}) {
  const claims = lerToken(tokenDoPedido(req))
  if (!claims) return null
  if (claims.trocar && !permitirTroca) return null
  const { rows } = await pool.query(`select ${COLUNAS_CONTA} from mao_contas where id = $1 and ativo`, [claims.sub])
  return rows[0] || null
}

export async function entrar({ identificador, senha }) {
  const chave = String(identificador || '').trim().toLowerCase()
  if (!chave || !senha) return { ok: false, status: 400, erro: 'Informe usuário e senha.' }
  if (bloqueado(chave)) {
    return { ok: false, status: 429, erro: 'Muitas tentativas. Aguarde 15 minutos ou use "Esqueci minha senha".' }
  }
  const { rows } = await pool.query(
    `select ${COLUNAS_CONTA.split(', ').map((c) => `c.${c}`).join(', ')}, k.senha_hash, k.trocar_senha
     from mao_contas c join mao_credenciais k on k.conta_id = c.id
     where lower(c.email) = $1 or lower(c.usuario) = $1
     limit 2`,
    [chave],
  )
  let achada = null
  for (const row of rows) {
    if (await conferirSenha(senha, row.senha_hash)) {
      achada = row
      break
    }
  }
  if (!achada) {
    registrarFalha(chave)
    return { ok: false, status: 401, erro: 'Usuário ou senha inválidos.' }
  }
  if (!achada.ativo) return { ok: false, status: 403, erro: 'Esta conta está desativada.' }
  falhas.delete(chave)
  return sessao(achada, achada.trocar_senha)
}

export async function sessaoAtual(req) {
  const conta = await contaDoPedido(req, { permitirTroca: true })
  if (!conta) return { ok: false, status: 401, erro: 'Sessão expirada. Entre de novo.' }
  const { rows } = await pool.query(`select trocar_senha from mao_credenciais where conta_id = $1`, [conta.id])
  return { ok: true, status: 200, conta: contaPublica(conta), trocarSenha: Boolean(rows[0]?.trocar_senha) }
}

export async function existe({ email, usuario }) {
  const em = String(email || '').trim().toLowerCase()
  const us = String(usuario || '').trim().toLowerCase()
  const res = { ok: true, status: 200, email: false, usuario: false }
  if (em) res.email = (await pool.query(`select 1 from mao_contas where lower(email) = $1 limit 1`, [em])).rowCount > 0
  if (us) res.usuario = (await pool.query(`select 1 from mao_contas where lower(usuario) = $1 limit 1`, [us])).rowCount > 0
  return res
}

export async function criarConta({ verify_token, usuario, senha }) {
  const us = String(usuario || '').trim()
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(us)) {
    return { ok: false, status: 400, erro: 'O usuário deve ter de 3 a 30 letras, números, ponto, hífen ou sublinhado.' }
  }
  const falhaSenha = problemaSenhaConta(senha, 'profissional')
  if (falhaSenha) return { ok: false, status: 400, erro: falhaSenha }
  const usado = await pool.query(`select 1 from mao_contas where lower(usuario) = lower($1) limit 1`, [us])
  if (usado.rowCount) return { ok: false, status: 409, erro: 'Nome de usuário já existe.' }

  const verificado = await consumirTokenVerificado(verify_token, 'cadastro')
  if (!verificado?.portalRole) {
    return { ok: false, status: 400, erro: 'Sessão de cadastro expirada. Solicite um novo código.' }
  }
  const emailUsado = await pool.query(`select 1 from mao_contas where lower(email) = $1 limit 1`, [verificado.email])
  if (emailUsado.rowCount) return { ok: false, status: 409, erro: 'Este e-mail já está sendo utilizado.' }

  const id = `user_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const hash = await gerarHashSenha(senha)
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const { rows } = await cliente.query(
      `insert into mao_contas (id, usuario, email, senha_hash, role, nivel_hierarquia, perfil_completo, ativo)
       values ($1, $2, $3, '', $4, 'operador', false, true) returning ${COLUNAS_CONTA}`,
      [id, us, verificado.email, verificado.portalRole],
    )
    await cliente.query(`insert into mao_credenciais (conta_id, senha_hash) values ($1, $2)`, [id, hash])
    await cliente.query('commit')
    return sessao(rows[0], false)
  } catch (erro) {
    await cliente.query('rollback').catch(() => {})
    if (erro?.code === '23505') return { ok: false, status: 409, erro: 'Usuário ou e-mail já cadastrado.' }
    throw erro
  } finally {
    cliente.release()
  }
}

export async function trocarSenha(req, { senhaAtual, novaSenha }) {
  const conta = await contaDoPedido(req, { permitirTroca: true })
  if (!conta) return { ok: false, status: 401, erro: 'Sessão expirada. Entre de novo.' }
  const { rows } = await pool.query(`select senha_hash from mao_credenciais where conta_id = $1`, [conta.id])
  if (!rows[0] || !(await conferirSenha(senhaAtual, rows[0].senha_hash))) {
    return { ok: false, status: 400, erro: 'A senha atual não confere.' }
  }
  if (String(novaSenha) === String(senhaAtual)) {
    return { ok: false, status: 400, erro: 'A nova senha precisa ser diferente da atual.' }
  }
  const falha = problemaSenhaConta(novaSenha, conta.role)
  if (falha) return { ok: false, status: 400, erro: falha }
  await pool.query(
    `update mao_credenciais set senha_hash = $2, trocar_senha = false, atualizado_em = now() where conta_id = $1`,
    [conta.id, await gerarHashSenha(novaSenha)],
  )
  return sessao(conta, false)
}

export async function redefinirSenha({ verify_token, novaSenha }) {
  const verificado = await consumirTokenVerificado(verify_token, 'senha')
  if (!verificado) return { ok: false, status: 400, erro: 'Sessão de troca de senha expirada. Solicite um novo código.' }
  const { rows } = await pool.query(`select ${COLUNAS_CONTA} from mao_contas where lower(email) = $1 limit 1`, [
    verificado.email,
  ])
  const conta = rows[0]
  if (!conta) return { ok: false, status: 404, erro: 'Usuário não encontrado.' }
  const falha = problemaSenhaConta(novaSenha, conta.role)
  if (falha) return { ok: false, status: 400, erro: falha }
  await pool.query(
    `insert into mao_credenciais (conta_id, senha_hash, trocar_senha) values ($1, $2, false)
     on conflict (conta_id) do update set senha_hash = excluded.senha_hash, trocar_senha = false, atualizado_em = now()`,
    [conta.id, await gerarHashSenha(novaSenha)],
  )
  return { ok: true, status: 200 }
}

/** Admin gera uma senha temporária (a pessoa troca no próximo login). Não guardamos senhas. */
export async function adminRedefinirSenha(req, { contaId }) {
  const admin = await contaDoPedido(req)
  if (!admin || !ehGestao(admin.role)) return { ok: false, status: 403, erro: 'Sem permissão.' }
  const { rows } = await pool.query(`select id, role from mao_contas where id = $1`, [String(contaId || '')])
  const alvo = rows[0]
  if (!alvo) return { ok: false, status: 404, erro: 'Usuário não encontrado.' }
  if (ehGestao(alvo.role) && admin.role !== 'super') {
    return { ok: false, status: 403, erro: 'Só um superusuário redefine a senha de outro gestor.' }
  }
  const senha = senhaTemporaria()
  await pool.query(
    `insert into mao_credenciais (conta_id, senha_hash, trocar_senha) values ($1, $2, true)
     on conflict (conta_id) do update set senha_hash = excluded.senha_hash, trocar_senha = true, atualizado_em = now()`,
    [alvo.id, await gerarHashSenha(senha)],
  )
  return { ok: true, status: 200, senhaTemporaria: senha }
}

// Hierarquia das empresas, a mesma do Oferta de Carga:
// Operador Logístico → Filial do Operador → Embarcador → Unidade → Transportadora.
const PAIS_VALIDOS = {
  operador_logistico: [],
  filial_operador: ['operador_logistico'],
  embarcador: ['filial_operador', 'operador_logistico'],
  unidade: ['embarcador', 'filial_operador'],
  transportadora: ['unidade', 'filial_operador'],
}
const TIPOS_NO_TOPO = ['operador_logistico', 'embarcador']
const TIPOS_EMPRESA = new Set([
  'transportadora',
  'operador_logistico',
  'industria',
  'centro_distribuicao',
  'atacadista',
  'varejo',
  'outro',
])
const texto = (v, max = 160) => String(v ?? '').trim().slice(0, max)
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '')

/**
 * A gestão cadastra uma empresa pelo painel: conta + empresa já aprovada, no ponto da hierarquia
 * escolhido (tipo e empresa acima dela). A empresa recebe por e-mail o login e uma senha provisória,
 * que ela troca no primeiro acesso. Só aqui a senha é conhecida, porque acabou de ser gerada.
 */
export async function adminCriarEmpresa(req, { usuario, email, orgTipo, orgPaiId, empresa }) {
  const admin = await contaDoPedido(req)
  if (!admin || !ehGestao(admin.role)) return { ok: false, status: 403, erro: 'Sem permissão.' }

  const us = texto(usuario, 30)
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(us)) {
    return { ok: false, status: 400, erro: 'O usuário deve ter de 3 a 30 letras, números, ponto, hífen ou sublinhado.' }
  }
  const em = texto(email, 160).toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return { ok: false, status: 400, erro: 'Informe um e-mail válido.' }

  // Ponto na hierarquia: o tipo precisa caber abaixo da empresa escolhida (ou no topo).
  const tipo = texto(orgTipo, 40)
  if (!(tipo in PAIS_VALIDOS)) return { ok: false, status: 400, erro: 'Escolha o tipo da empresa na hierarquia.' }
  const paiId = texto(orgPaiId, 60) || null
  let superiorUsuario = admin.usuario
  if (paiId) {
    const { rows } = await pool.query(
      `select e.payload->>'orgTipo' as tipo, c.usuario from mao_empresas e join mao_contas c on c.id = e.user_id where e.id = $1`,
      [paiId],
    )
    if (!rows[0]) return { ok: false, status: 400, erro: 'A empresa escolhida acima desta não foi encontrada.' }
    if (!PAIS_VALIDOS[tipo].includes(rows[0].tipo)) {
      return { ok: false, status: 400, erro: 'Esse tipo não pode ficar abaixo da empresa escolhida.' }
    }
    superiorUsuario = rows[0].usuario
  } else if (!TIPOS_NO_TOPO.includes(tipo)) {
    return { ok: false, status: 400, erro: 'No topo da hierarquia só entram Operador Logístico ou Embarcador.' }
  }

  const d = empresa && typeof empresa === 'object' ? empresa : {}
  const razaoSocial = texto(d.razaoSocial)
  const nomeFantasia = texto(d.nomeFantasia)
  const cnpj = soDigitos(d.cnpj)
  const end = d.endereco && typeof d.endereco === 'object' ? d.endereco : {}
  const cidade = texto(end.cidade, 80)
  const estado = texto(end.estado, 2).toUpperCase()
  if (!razaoSocial || !nomeFantasia) return { ok: false, status: 400, erro: 'Informe a razão social e o nome fantasia.' }
  if (cnpj.length !== 14) return { ok: false, status: 400, erro: 'Informe o CNPJ com 14 dígitos.' }
  if (!cidade || estado.length !== 2) return { ok: false, status: 400, erro: 'Informe a cidade e a UF da empresa.' }

  const usado = await pool.query(
    `select lower(usuario) = lower($1) as mesmo_usuario from mao_contas where lower(usuario) = lower($1) or lower(email) = $2 limit 1`,
    [us, em],
  )
  if (usado.rowCount) {
    return { ok: false, status: 409, erro: usado.rows[0].mesmo_usuario ? 'Nome de usuário já existe.' : 'Este e-mail já está sendo utilizado.' }
  }
  const cnpjUsado = await pool.query(
    `select 1 from mao_empresas where regexp_replace(coalesce(payload->>'cnpj', ''), '\\D', '', 'g') = $1 limit 1`,
    [cnpj],
  )
  if (cnpjUsado.rowCount) return { ok: false, status: 409, erro: 'Já existe uma empresa com este CNPJ.' }

  // Cidade desconhecida chega como null (NaN no JSON): não pode virar 0,0 no mapa.
  const lat = typeof end.lat === 'number' ? end.lat : NaN
  const lng = typeof end.lng === 'number' ? end.lng : NaN
  const payload = {
    cnpj: texto(d.cnpj, 20),
    razaoSocial,
    nomeFantasia,
    tipo: TIPOS_EMPRESA.has(d.tipo) ? d.tipo : 'outro',
    plano: 'gratuito',
    responsavelNome: texto(d.responsavelNome, 120),
    responsavelCpf: texto(d.responsavelCpf, 20),
    responsavelCargo: texto(d.responsavelCargo, 80),
    telefone: texto(d.telefone, 20),
    endereco: {
      cep: texto(end.cep, 10),
      rua: texto(end.rua, 120),
      numero: texto(end.numero, 20),
      cidade,
      estado,
      ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
    },
    avaliacaoMedia: 5,
    favoritos: [],
    bloqueados: [],
    docsOk: true,
    saldo: 0,
    limitePosPago: 3000,
    diasTaxaZero: 0,
    metaTaxaZero: 300,
    diasAgenciados: 0,
    rankingDias: 999,
    economiaTotal: 0,
    orgTipo: tipo,
    orgPaiId: paiId,
    cadastradaPor: admin.usuario,
  }

  const sufixo = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const contaId = `user_${sufixo()}`
  const empresaId = `emp_${sufixo()}`
  const senha = senhaTemporaria()
  const hash = await gerarHashSenha(senha)
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    await cliente.query(
      `insert into mao_contas (id, usuario, email, senha_hash, role, nivel_hierarquia, superior_usuario, perfil_completo, ativo)
       values ($1, $2, $3, '', 'empresa', 'operador', $4, true, true)`,
      [contaId, us, em, superiorUsuario],
    )
    await cliente.query(`insert into mao_credenciais (conta_id, senha_hash, trocar_senha) values ($1, $2, true)`, [contaId, hash])
    await cliente.query(`insert into mao_empresas (id, user_id, status, payload) values ($1, $2, 'aprovada', $3)`, [
      empresaId,
      contaId,
      JSON.stringify(payload),
    ])
    await cliente.query('commit')
  } catch (erro) {
    await cliente.query('rollback').catch(() => {})
    if (erro?.code === '23505') return { ok: false, status: 409, erro: 'Usuário ou e-mail já cadastrado.' }
    throw erro
  } finally {
    cliente.release()
  }

  const { assunto, texto: corpo, html } = montarEmailContaCriada({ nome: nomeFantasia, usuario: us, email: em, senha })
  const envio = await enviarEmail({ para: em, assunto, texto: corpo, html, rotulo: 'o acesso da empresa cadastrada' })
  return {
    ok: true,
    status: 200,
    contaId,
    empresaId,
    usuario: us,
    email: em,
    senhaTemporaria: senha,
    emailEnviado: Boolean(envio.ok),
  }
}

export { ehGestao }
