/**
 * Aplicativo Android (pasta android/ do projeto): a parte do servidor que conversa com ele.
 *
 * O app abre o próprio site em tela cheia (Trusted Web Activity). Além disso, em código nativo, ele tem um widget
 * e avisos (notificações) que funcionam com o app fechado. Para isso ele busca um resumo da conta sem a sessão do
 * navegador, com um código próprio do celular, criado pelo botão "Ativar neste celular" (tela Aplicativo).
 *
 *   POST /api/app/ativar      (sessão)          cria o código de um celular e devolve uma vez só
 *   GET  /api/app/aparelhos   (sessão)          celulares ativados na conta
 *   POST /api/app/desativar   (sessão)          desativa um celular (ou todos)
 *   GET  /api/app/resumo      (X-App-Token)     números e novidades da conta, para o widget e os avisos
 *   POST /api/app/sair        (X-App-Token)     o próprio celular se desativa
 *
 * O resumo traz só o que a conta já vê no site: números, cargo, cidade e data das vagas dela.
 */
import { createHash, randomBytes } from 'node:crypto'
import { pool } from './migrar.mjs'
import { contaDoPedido, ehGestao } from './rotasAuth.mjs'

const MAX_APARELHOS = 5
const MAX_AVISOS = 30
const DIAS_VAGA_NOVA = 7

const hashDoCodigo = (codigo) => createHash('sha256').update(String(codigo)).digest('hex')

function codigoDoPedido(req) {
  const codigo = String(req.headers['x-app-token'] || '').trim()
  return /^[A-Za-z0-9_-]{30,100}$/.test(codigo) ? codigo : null
}

// ---------- Ativação (com a sessão do site) ----------

export async function ativarAparelho(req) {
  const conta = await contaDoPedido(req)
  if (!conta) return { ok: false, status: 401, erro: 'Entre na sua conta para ativar o celular.' }
  const token = randomBytes(32).toString('base64url')
  const id = `apa_${randomBytes(9).toString('base64url')}`
  await pool.query(`insert into mao_app_aparelhos (id, conta_id, token_hash) values ($1, $2, $3)`, [
    id,
    conta.id,
    hashDoCodigo(token),
  ])
  // Só os últimos celulares continuam valendo.
  await pool.query(
    `delete from mao_app_aparelhos where conta_id = $1 and id not in (
       select id from mao_app_aparelhos where conta_id = $1
       order by coalesce(visto_em, criado_em) desc limit $2)`,
    [conta.id, MAX_APARELHOS],
  )
  return { ok: true, id, token }
}

export async function listarAparelhos(req) {
  const conta = await contaDoPedido(req)
  if (!conta) return { ok: false, status: 401, erro: 'Entre na sua conta.' }
  const { rows } = await pool.query(
    `select id, versao, criado_em, visto_em from mao_app_aparelhos where conta_id = $1
     order by coalesce(visto_em, criado_em) desc`,
    [conta.id],
  )
  return {
    ok: true,
    aparelhos: rows.map((r) => ({ id: r.id, versao: r.versao, criadoEm: r.criado_em, vistoEm: r.visto_em })),
  }
}

export async function desativarAparelho(req, { id }) {
  const conta = await contaDoPedido(req)
  if (!conta) return { ok: false, status: 401, erro: 'Entre na sua conta.' }
  if (id === 'todos') {
    await pool.query(`delete from mao_app_aparelhos where conta_id = $1`, [conta.id])
  } else {
    if (typeof id !== 'string' || !id) return { ok: false, status: 400, erro: 'Celular não informado.' }
    await pool.query(`delete from mao_app_aparelhos where conta_id = $1 and id = $2`, [conta.id, id])
  }
  return { ok: true }
}

// ---------- O celular (com o código dele) ----------

export async function sairDoAparelho(req) {
  const codigo = codigoDoPedido(req)
  if (codigo) await pool.query(`delete from mao_app_aparelhos where token_hash = $1`, [hashDoCodigo(codigo)])
  return { ok: true }
}

export async function resumoDoAparelho(req) {
  const codigo = codigoDoPedido(req)
  if (!codigo) return { ok: false, status: 401, erro: 'Celular não ativado.' }
  const versao = String(req.headers['x-app-versao'] || '').trim().slice(0, 20) || null
  const { rows } = await pool.query(
    `update mao_app_aparelhos a set visto_em = now(), versao = coalesce($2, a.versao)
     from mao_contas c
     where a.token_hash = $1 and c.id = a.conta_id and c.ativo
     returning c.id, c.usuario, c.role`,
    [hashDoCodigo(codigo), versao],
  )
  const conta = rows[0]
  if (!conta) return { ok: false, status: 401, erro: 'Celular não ativado.' }
  if (conta.role === 'profissional') return { ok: true, ...(await resumoProfissional(conta)) }
  if (conta.role === 'empresa') return { ok: true, ...(await resumoEmpresa(conta)) }
  if (ehGestao(conta.role)) return { ok: true, ...(await resumoGestao(conta)) }
  return { ok: true, nome: conta.usuario, titulo: 'fazumfreela', itens: [], avisos: [], atalhos: [], abrir: '/' }
}

// ---------- Ajudantes ----------

/** Data de hoje (AAAA-MM-DD) no horário de Brasília, com deslocamento em dias. */
function hojeSP(dias = 0) {
  return new Date(Date.now() + dias * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function dataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}/${m[2]}` : ''
}

const reais = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })

const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

function distanciaKm(a, b) {
  const nums = [a?.lat, a?.lng, b?.lat, b?.lng].map(Number)
  if (!nums.every((n) => Number.isFinite(n)) || nums.some((n) => n === 0)) return Number.NaN
  const [lat1, lng1, lat2, lng2] = nums
  const rad = (g) => (g * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/** A vaga ainda não terminou. */
const vigente = (d, hoje) => String(d.dataFim || d.data || '') >= hoje
const juntar = (...partes) => partes.filter(Boolean).join(' · ')
const comItem = (r) => ({ ...(r.payload || {}), id: r.id, empresaId: r.payload?.empresaId ?? r.empresa_id ?? null })

function organizarAvisos(lista) {
  return lista
    .sort((a, b) => String(b.quando || '').localeCompare(String(a.quando || '')))
    .slice(0, MAX_AVISOS)
    .map(({ quando: _q, ...aviso }) => aviso)
}

async function nomesDasEmpresas(ids) {
  if (!ids.length) return new Map()
  const { rows } = await pool.query(
    `select id, coalesce(nullif(payload->>'nomeFantasia', ''), payload->>'razaoSocial') as nome,
            coalesce(payload->'bloqueados', '[]'::jsonb) as bloqueados
     from mao_empresas where id = any($1)`,
    [ids],
  )
  return new Map(rows.map((r) => [r.id, { nome: r.nome || '', bloqueados: Array.isArray(r.bloqueados) ? r.bloqueados : [] }]))
}

// ---------- Profissional: convites, vagas novas e trabalhos confirmados ----------

async function resumoProfissional(conta) {
  const { rows: perfis } = await pool.query(`select id, status, payload from mao_profissionais where user_id = $1`, [
    conta.id,
  ])
  const base = {
    titulo: 'fazumfreela · Trabalhador',
    abrir: '/?aba=vagas',
    atalhos: [
      { id: 'agenda', rotulo: 'Vagas aceitas', link: '/?aba=agenda' },
      { id: 'financeiro', rotulo: 'Financeiro', link: '/?aba=financeiro' },
    ],
  }
  const perfil = perfis[0]
  if (!perfil) return { ...base, nome: conta.usuario, itens: [], avisos: [] }
  const p = perfil.payload || {}
  const hoje = hojeSP()
  const desde = hojeSP(-DIAS_VAGA_NOVA)

  const cands = (
    await pool.query(`select id, empresa_id, payload from mao_registros where colecao = 'candidaturas' and profissional_id = $1`, [
      perfil.id,
    ])
  ).rows.map(comItem)
  const ids = cands.map((c) => c.demandaId).filter(Boolean)
  const demandas = (
    await pool.query(
      `select id, empresa_id, payload from mao_registros
       where colecao = 'demandas' and (payload->>'status' in ('aberta', 'em_andamento') or id = any($1))`,
      [ids],
    )
  ).rows.map(comItem)
  const porId = new Map(demandas.map((d) => [d.id, d]))
  const empresas = await nomesDasEmpresas([...new Set(demandas.map((d) => d.empresaId).filter(Boolean))])
  const nomeEmpresa = (d) => empresas.get(d.empresaId)?.nome || ''
  const cidade = (d) => d.endereco?.cidade || ''

  const convites = cands.filter((c) => {
    const d = porId.get(c.demandaId)
    return c.status === 'pendente' && c.origem === 'convite' && d?.status === 'aberta' && vigente(d, hoje)
  })
  const confirmados = cands.filter((c) => {
    const d = porId.get(c.demandaId)
    return c.status === 'confirmada' && d && (d.status === 'aberta' || d.status === 'em_andamento') && vigente(d, hoje)
  })

  // Vagas novas que a aba Vagas mostraria (mesmos filtros do site).
  const verTodas = p.verTodasVagas !== false
  const profissoes = Array.isArray(p.profissoes) ? p.profissoes : []
  const raio = Number(p.raioKm) || 0
  const comCandidatura = new Set(ids)
  const vagasNovas = demandas.filter((d) => {
    if (d.status !== 'aberta' || !vigente(d, hoje) || String(d.createdAt || '').slice(0, 10) < desde) return false
    if (comCandidatura.has(d.id)) return false
    if (empresas.get(d.empresaId)?.bloqueados.includes(perfil.id)) return false
    if (!verTodas && !profissoes.includes(d.cargo)) return false
    const dist = distanciaKm(p.endereco, d.endereco)
    const mesmaCidade = semAcento(cidade(d)) !== '' && semAcento(cidade(d)) === semAcento(p.endereco?.cidade)
    return mesmaCidade || !Number.isFinite(dist) || dist <= raio
  })

  const avisos = [
    ...convites.map((c) => {
      const d = porId.get(c.demandaId)
      return {
        id: `convite:${c.id}`,
        titulo: `Convite: ${d.cargo}`,
        texto: juntar(nomeEmpresa(d), dataBR(d.data) && `a partir de ${dataBR(d.data)}`, cidade(d)),
        link: '/?aba=vagas',
        quando: c.createdAt,
      }
    }),
    ...confirmados.map((c) => {
      const d = porId.get(c.demandaId)
      return {
        id: `contratado:${c.id}`,
        titulo: `Contratação confirmada: ${d.cargo}`,
        texto: juntar(nomeEmpresa(d), dataBR(d.data) && `começa em ${dataBR(d.data)}`, cidade(d)),
        link: '/?aba=agenda',
        quando: c.respondidoEm || c.createdAt,
      }
    }),
    ...vagasNovas.map((d) => ({
      id: `vaga:${d.id}`,
      titulo: `Vaga nova: ${d.cargo}`,
      texto: juntar(cidade(d), d.valorDiaria ? `${reais(d.valorDiaria)} por dia` : '', dataBR(d.data) && `a partir de ${dataBR(d.data)}`),
      link: '/?aba=vagas',
      quando: d.createdAt,
    })),
  ]

  return {
    ...base,
    nome: p.nome || conta.usuario,
    itens: [
      { rotulo: 'Convites', valor: convites.length },
      { rotulo: 'Vagas novas', valor: vagasNovas.length },
      { rotulo: 'Trabalhos confirmados', valor: confirmados.length },
    ],
    avisos: organizarAvisos(avisos),
  }
}

// ---------- Empresa: vagas abertas, candidatos para confirmar e quem está em serviço ----------

async function resumoEmpresa(conta) {
  const { rows: emps } = await pool.query(
    `select id, coalesce(nullif(payload->>'nomeFantasia', ''), payload->>'razaoSocial') as nome
     from mao_empresas where user_id = $1`,
    [conta.id],
  )
  const base = {
    titulo: 'fazumfreela · Empresa',
    abrir: '/?aba=vagas',
    atalhos: [
      { id: 'missao', rotulo: 'Publicar vaga', link: '/?aba=missao' },
      { id: 'contratacoes', rotulo: 'Contratações', link: '/?aba=contratacoes' },
    ],
  }
  if (!emps.length) return { ...base, nome: conta.usuario, itens: [], avisos: [] }
  const eids = emps.map((e) => e.id)
  const hoje = hojeSP()
  const consulta = (colecao, extra = '', valores = []) =>
    pool
      .query(`select id, empresa_id, payload from mao_registros where colecao = $1 and empresa_id = any($2) ${extra}`, [
        colecao,
        eids,
        ...valores,
      ])
      .then((r) => r.rows.map(comItem))
  const [demandas, cands, pontos] = await Promise.all([
    consulta('demandas'),
    consulta('candidaturas', `and payload->>'status' = 'aceita'`),
    consulta('checkIns', `and payload->>'data' = $3`, [hoje]),
  ])
  const porId = new Map(demandas.map((d) => [d.id, d]))
  const abertas = demandas.filter((d) => d.status === 'aberta')
  const aguardando = cands.filter((c) => porId.get(c.demandaId)?.status === 'aberta')
  const emServico = pontos.filter((c) => c.checkInAt && !c.checkOutAt)

  const avisos = aguardando.map((c) => {
    const d = porId.get(c.demandaId)
    return {
      id: `candidato:${c.id}`,
      titulo: c.origem === 'convite' ? `Convite aceito: ${d.cargo}` : `Novo candidato: ${d.cargo}`,
      texto: juntar(dataBR(d.data) && `vaga de ${dataBR(d.data)}`, d.endereco?.cidade, 'confirme no fazumfreela'),
      link: '/?aba=vagas',
      quando: c.respondidoEm || c.createdAt,
    }
  })

  return {
    ...base,
    nome: emps[0].nome || conta.usuario,
    itens: [
      { rotulo: 'Vagas abertas', valor: abertas.length },
      { rotulo: 'Candidatos para confirmar', valor: aguardando.length },
      { rotulo: 'Em serviço agora', valor: emServico.length },
    ],
    avisos: organizarAvisos(avisos),
  }
}

// ---------- Gestão: cadastros para aprovar ----------

async function resumoGestao(conta) {
  const [prof, emp, vagas] = await Promise.all([
    pool.query(`select id, payload->>'nome' as nome, created_at from mao_profissionais where status = 'pendente'
                order by created_at desc limit 50`),
    pool.query(`select id, coalesce(nullif(payload->>'nomeFantasia', ''), payload->>'razaoSocial') as nome, created_at
                from mao_empresas where status = 'pendente' order by created_at desc limit 50`),
    pool.query(`select count(*)::int as n from mao_registros where colecao = 'demandas' and payload->>'status' = 'aberta'`),
  ])
  const avisos = [
    ...prof.rows.map((r) => ({
      id: `cadastro-prof:${r.id}`,
      titulo: 'Profissional para aprovar',
      texto: r.nome || 'Cadastro novo',
      link: '/?aba=profissionais',
      quando: r.created_at?.toISOString?.() || '',
    })),
    ...emp.rows.map((r) => ({
      id: `cadastro-emp:${r.id}`,
      titulo: 'Empresa para aprovar',
      texto: r.nome || 'Cadastro novo',
      link: '/?aba=empresas',
      quando: r.created_at?.toISOString?.() || '',
    })),
  ]
  return {
    titulo: 'fazumfreela · Gestão',
    nome: conta.usuario,
    abrir: '/',
    atalhos: [
      { id: 'profissionais', rotulo: 'Profissionais', link: '/?aba=profissionais' },
      { id: 'empresas', rotulo: 'Empresas', link: '/?aba=empresas' },
    ],
    itens: [
      { rotulo: 'Profissionais para aprovar', valor: prof.rows.length },
      { rotulo: 'Empresas para aprovar', valor: emp.rows.length },
      { rotulo: 'Vagas abertas', valor: vagas.rows[0]?.n ?? 0 },
    ],
    avisos: organizarAvisos(avisos),
  }
}
