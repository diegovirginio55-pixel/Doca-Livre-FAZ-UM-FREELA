import type { ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function responderJson(res: ServerResponse, status: number, corpo: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(corpo))
}

function portalApiDev(): Plugin {
  return {
    name: 'portal-api-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]
        const email = path === '/api/portal/enviar-codigo' && req.method === 'POST'
        const documento = path === '/api/cadastro/analisar-documento' && req.method === 'POST'
        const curriculo = path === '/api/cadastro/ler-curriculo' && req.method === 'POST'
        if (!email && !documento && !curriculo) {
          next()
          return
        }
        const limite = documento ? 8_000_000 : curriculo ? 3_500_000 : 8000
        const partes: Buffer[] = []
        let tamanho = 0
        let estourou = false
        req.on('data', (parte: Buffer) => {
          tamanho += parte.length
          if (tamanho > limite) {
            estourou = true
            responderJson(res, 413, {
              ok: false,
              erro: documento
                ? 'A foto ficou grande demais. Envie uma imagem menor.'
                : curriculo
                  ? 'O currículo ficou grande demais. Envie um arquivo menor.'
                  : 'Não foi possível enviar o e-mail.',
            })
            req.destroy()
            return
          }
          partes.push(parte)
        })
        req.on('end', () => {
          if (estourou) return
          void (async () => {
            let data: {
              email?: string
              codigo?: string
              finalidade?: string
              nome?: string
              contexto?: string
              tipo?: string
              cnpj?: string
              cidade?: string
              arquivos?: { papel?: string; mime?: string; dados?: string }[]
              texto?: string
              imagem?: { mime?: string; dados?: string }
              cargos?: { id?: string; label?: string }[]
            } = {}
            try {
              data = JSON.parse(Buffer.concat(partes).toString('utf8') || '{}') as typeof data
            } catch {
              responderJson(res, 400, {
                ok: false,
                erro: documento
                  ? 'Não foi possível analisar o documento.'
                  : curriculo
                    ? 'Não foi possível ler o currículo.'
                    : 'Não foi possível enviar o e-mail.',
              })
              return
            }
            if (curriculo) {
              const { lerCurriculo } = await import('./server/lerCurriculo.mjs')
              const result = await lerCurriculo({ texto: data.texto, imagem: data.imagem, cargos: data.cargos, env })
              responderJson(
                res,
                result.ok ? 200 : result.status,
                result.ok ? { ok: true, curriculo: result.curriculo } : { ok: false, erro: result.erro },
              )
              return
            }
            if (documento) {
              const { analisarDocumentoCadastro } = await import('./server/analisarDocumentoCadastro.mjs')
              const result = await analisarDocumentoCadastro({
                nome: data.nome,
                arquivos: data.arquivos,
                contexto: data.contexto,
                tipo: data.tipo,
                cnpj: data.cnpj,
                cidade: data.cidade,
                env,
              })
              responderJson(
                res,
                result.ok ? 200 : result.status,
                result.ok
                  ? { ok: true, aceito: result.aceito, motivo: result.motivo, cnh: result.cnh || '' }
                  : { ok: false, erro: result.erro },
              )
              return
            }
            const { enviarCodigoEmail } = await import('./server/enviarCodigoEmail.mjs')
            const result = await enviarCodigoEmail({
              email: data.email,
              codigo: data.codigo,
              finalidade: data.finalidade,
              env,
            })
            responderJson(res, result.ok ? 200 : result.status, result.ok ? { ok: true } : { ok: false, erro: result.erro })
          })().catch(() => {
            if (!res.writableEnded) {
              responderJson(res, 503, {
                ok: false,
                erro: documento
                  ? 'Não foi possível analisar o documento.'
                  : curriculo
                    ? 'Não foi possível ler o currículo.'
                    : 'Não foi possível enviar o e-mail.',
              })
            }
          })
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), portalApiDev()],
  server: {
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
  build: {
    // Evita um único JS grande (~560KB) que em alguns deploys do Render
    // sumiu do CDN (HTML 200 + assets/*.js 404).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/')) return 'react'
            if (id.includes('@supabase')) return 'supabase'
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
