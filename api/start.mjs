import { spawn } from 'node:child_process'

const senha = encodeURIComponent(process.env.PGPASSWORD || '')
process.env.PGRST_DB_URI = `postgres://${process.env.PGUSER}:${senha}@${process.env.PGHOST}:5432/${process.env.PGDATABASE}?sslmode=require`
process.env.PGRST_DB_SCHEMAS = 'public'
process.env.PGRST_DB_ANON_ROLE = 'web'
process.env.PGRST_SERVER_HOST = '127.0.0.1'
process.env.PGRST_SERVER_PORT = '3001'

const { preparar } = await import('./migrar.mjs')
try {
  await preparar()
} catch (erro) {
  const mensagem = erro instanceof Error ? erro.message : 'Falha ao preparar'
  console.error(mensagem)
  process.env.MIGRACAO_ERRO = mensagem
}

const postgrest = spawn('/usr/local/bin/postgrest', [], { stdio: 'inherit' })
postgrest.on('exit', (codigo) => {
  console.error(`postgrest encerrou ${codigo}`)
})

await import('./server.js')
