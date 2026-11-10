# Deploy — Doca Livre fazumfreela

São duas peças, publicadas **juntas** (a versão nova do site não funciona com a API antiga e vice-versa):

1. **API (Azure Container Apps)** — pasta `api/`: login, senhas, código por e-mail, banco (PostgREST) e documentos (Azure Blob).
2. **Site (Render)** — `render.yaml`: só serve os arquivos do site (`node server/index.mjs`).

Repo: https://github.com/eldertenorio-max/Doca-Livre-M-o-de-Obra

## 1. API no Azure

Imagem Docker a partir de `api/Dockerfile`. Ao iniciar, `start.mjs` roda a migração (`api/sql/001…003` + `migrar.mjs`) e sobe o PostgREST e a API.

### Variáveis de ambiente

| Key | Obrigatória | Para quê |
|-----|-------------|----------|
| `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | sim | Banco PostgreSQL. `PGUSER` precisa ser dono das tabelas e poder assumir o papel `web`. |
| `ANON_KEY` | sim | Chave pública do site (`sb_publishable_…`, a mesma de `src/lib/supabaseConfig.ts`). |
| `JWT_SECRET` | recomendada | Segredo do token de sessão (32+ caracteres aleatórios). Sem ela, é derivado de `PGPASSWORD` — trocar a senha do banco desloga todo mundo. |
| `STORAGE_SIGN_SECRET` | recomendada | Segredo dos links de documento. Sem ela usa `AZURE_STORAGE_KEY` ou `PGPASSWORD`. |
| `AZURE_STORAGE_KEY` ou identidade gerenciada (`AZURE_CLIENT_ID`) | sim | Acesso ao Blob `stofertacargaprod/mao-documentos`. O container deve ser **privado**. |
| `RESEND_API_KEY`, `RESEND_FROM` | sim | E-mail do código de cadastro/senha e de aprovação. Remetente de domínio verificado. |
| `GEMINI_API_KEY` (e/ou `CLOUDFLARE_*`, `OPENROUTER_API_KEY`) | opcional | Análise automática de documento e leitura de currículo. Sem elas, vai tudo para a validação manual. |
| `IMPORT_TOKEN` | opcional | Protege `/copiar` e as contagens do `/saude`. |

### O que a migração faz (uma vez, sem apagar dados)

- Cria `mao_credenciais` e passa as senhas antigas (que estavam em texto puro em `mao_contas.senha_hash`) para hash scrypt. Quem já tinha conta entra com a mesma senha.
- Cria `mao_registros` (vagas, candidaturas, contratos, pagamentos, avaliações…).
- Tira o acesso total do papel `web` e liga as regras por usuário (RLS). Sem login, o banco não devolve nada.
- Cria as contas de gestão `Diego`, `Elder` (super) e `admin` com a senha antiga e **troca obrigatória no primeiro login**. Se já existirem, não mexe.

Depois do deploy: `GET /saude` deve responder `{"ok":true,"rest":true}`. Se aparecer `erro`, a migração falhou (o texto diz onde) e nada foi alterado no banco.

## 2. Site no Render

1. https://dashboard.render.com → **New +** → **Blueprint** → repo acima. O `render.yaml` cria o serviço `doca-livre-mao-de-obra`.
2. Variáveis: `NODE_VERSION` = `20.19.0` (já vem). As demais (`RESEND_*`, `GEMINI_API_KEY`) não são mais usadas pelo site — ficam só na API do Azure.
3. Build: `npm ci && npm run build`. Start: `node server/index.mjs`.

O site fala com a API em `https://fazumfreela-api.purpleocean-4b1d485c.brazilsouth.azurecontainerapps.io` (fixo em `src/lib/supabaseConfig.ts`).

## Depois do deploy

1. Entre no **Admin** com `Diego`, `Elder` e `admin` (senha antiga) e defina a senha forte pedida na tela. Faça isso logo: até a troca, a senha antiga é a mesma que já circulou.
2. Teste o cadastro de uma empresa: portal Empresa → **Criar conta** → código por e-mail → formulário → aparece em Admin → Empresas como pendente → **Ver cadastro** abre os documentos.
3. Quem esquecer a senha: **Esqueci a senha** (e-mail) ou, no Admin, **Senha provisória** (a pessoa troca no primeiro login). O sistema não guarda senhas legíveis — nem o admin consegue vê-las.

## Modo demonstração

Botão **Ver demonstração** na tela inicial: dados fictícios só no navegador, sem nenhum acesso ao banco. As contas demo (`logexpress`, `joao`, `Diego`… com `demo123`) só existem nesse modo.

## Rodar local

```bash
npm install
npm run dev
```

O site local também usa a API do Azure. Para testar sem tocar em produção, use o modo demonstração.
