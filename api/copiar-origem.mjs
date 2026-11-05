import pg from 'pg'

const supaUrl = process.env.SUPABASE_URL || 'https://wsympxaarlrfdasmpbyf.supabase.co'
const supaKey = process.env.SUPABASE_KEY || 'sb_publishable_h_-Uv-VBm6GfOwG8BVFNxQ_MDnxMjpI'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const tabelasOrdem = [
  'mao_usuarios',
  'mao_email_codigos',
  'mao_permissoes',
  'mao_hierarquia_niveis',
  'mao_org_nos',
  'mao_grupos_hierarquia',
  'mao_grupos_hierarquia_membros',
  'mao_app_state',
  'mao_contas',
  'mao_profissionais',
  'mao_empresas',
  'mao_documentos',
]

const conflitoColunas = {
  mao_usuarios: ['usuario'],
  mao_email_codigos: ['id'],
  mao_permissoes: ['usuario', 'sistema'],
  mao_hierarquia_niveis: ['id'],
  mao_org_nos: ['id'],
  mao_grupos_hierarquia: ['id'],
  mao_grupos_hierarquia_membros: ['grupo_id', 'usuario'],
  mao_app_state: ['id'],
  mao_contas: ['id'],
  mao_profissionais: ['id'],
  mao_empresas: ['id'],
  mao_documentos: ['id'],
}

async function buscarSupabase(tabela) {
  const res = await fetch(`${supaUrl}/rest/v1/${tabela}?select=*`, {
    headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Erro ao buscar ${tabela}: ${res.status} ${txt}`)
  }
  return await res.json()
}

async function gravarTabela(tabela, linhas) {
  if (!linhas.length) return 0
  const colRes = await pool.query(
    `select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = $1`,
    [tabela],
  )
  const colNames = new Set(colRes.rows.map((r) => r.column_name))
  const colTypes = new Map(colRes.rows.map((r) => [r.column_name, r.data_type]))
  const chaves = conflitoColunas[tabela] || ['id']

  let count = 0
  for (const linha of linhas) {
    const pares = Object.entries(linha).filter(([k, v]) => colNames.has(k) && v !== undefined)
    const campos = pares.map(([k]) => `"${k}"`)
    const valores = pares.map(([k, v]) => {
      const tipo = colTypes.get(k)
      if (v !== null && (tipo === 'jsonb' || tipo === 'json')) {
        return typeof v === 'string' ? v : JSON.stringify(v)
      }
      return v
    })
    const marcas = pares.map((_, i) => `$${i + 1}`)
    const atualizaveis = pares.filter(([k]) => !chaves.includes(k))
    const acao = atualizaveis.length
      ? `do update set ${atualizaveis.map(([k]) => `"${k}" = excluded."${k}"`).join(', ')}`
      : `do nothing`

    const sql = `insert into "${tabela}" (${campos.join(', ')}) values (${marcas.join(', ')})
                 on conflict (${chaves.map((k) => `"${k}"`).join(', ')}) ${acao}`
    await pool.query(sql, valores)
    count++
  }
  return count
}

export async function copiarTudo() {
  console.log('Migrando dados de Supabase para Azure PostgreSQL...')
  for (const t of tabelasOrdem) {
    const linhas = await buscarSupabase(t)
    const gravados = await gravarTabela(t, linhas)
    console.log(`Tabela ${t}: ${gravados} registros copiados/atualizados`)
  }
  console.log('\n--- Verificação final no Azure PostgreSQL ---')
  for (const t of tabelasOrdem) {
    const r = await pool.query(`select count(*)::int as total from "${t}"`)
    console.log(`${t}: ${r.rows[0].total} registros`)
  }
}

if (process.argv[1]?.endsWith('copiar-origem.mjs')) {
  copiarTudo()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e)
      pool.end()
      process.exit(1)
    })
}
