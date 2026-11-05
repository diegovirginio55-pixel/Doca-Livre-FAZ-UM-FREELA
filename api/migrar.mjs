import fs from 'node:fs'
import pg from 'pg'

export const pool = new pg.Pool({
  ssl: process.env.PGHOST ? { rejectUnauthorized: false } : undefined,
})

const arquivos = ['001_tabelas.sql', '002_permissoes.sql']

export async function preparar() {
  for (const nome of arquivos) {
    const sql = fs.readFileSync(new URL(`./sql/${nome}`, import.meta.url), 'utf8')
    await pool.query(sql)
  }
  try {
    await pool.query("notify pgrst, 'reload schema'")
  } catch {
    /* ignore se pgrst nao estiver escutando ainda */
  }
}
