# Supabase — Doca Livre fazumfreela

Cadastro, aprovação e login entre aparelhos usam o projeto Supabase
`wsympxaarlrfdasmpbyf`. Sem as variáveis configuradas o app continua em
modo local (localStorage + seed de demonstração).

## 1. Variáveis no app / Render

Em **Project Settings → API** copie:

- Project URL → `VITE_SUPABASE_URL`
- `anon` `public` key → `VITE_SUPABASE_ANON_KEY`

No `.env` local e no Render:

```
VITE_SUPABASE_URL=https://wsympxaarlrfdasmpbyf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
RESEND_API_KEY=re_...
RESEND_FROM=Doca Livre fazumfreela <seu@dominio-verificado.com>
```

O build gera `public/supabase-config.json` via
`node scripts/write-supabase-config.mjs`.

> **Nota (Windows/IPv6):** o host `db.<ref>.supabase.co` pode falhar por
> IPv6. Use o pooler da região, ex.:
> `postgresql://postgres.<ref>:[SENHA]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres`

## 2. Migrations (obrigatório antes de testar sync)

Na pasta do projeto (já linkada ao ref `wsympxaarlrfdasmpbyf`):

```bash
npx supabase db push
```

Isso aplica, nesta ordem:

1. `supabase/migrations/20260720200000_bootstrap_mao_de_obra.sql`
2. `supabase/migrations/20260720201000_rls_hierarquia_niveis.sql`
3. `supabase/migrations/20261104120000_cadastros_sincronizados.sql`

A migration nova cria:

- `mao_contas` — usuários do app (ids texto iguais ao localStorage)
- `mao_profissionais` / `mao_empresas` — perfis + status de aprovação
- `mao_documentos` — metadados dos arquivos de cadastro
- colunas de token em `mao_email_codigos` (OTP entre aparelhos)
- bucket Storage privado `mao-documentos`

Alternativa manual: cole o SQL de cada arquivo no **SQL Editor** do
dashboard, na mesma ordem.

## 3. Edge Function `enviar-codigo` (OTP no servidor)

O código de e-mail **é gerado e conferido no servidor** (não no
`localStorage`). Publique a função atualizada:

```bash
npx supabase functions deploy enviar-codigo --no-verify-jwt
```

Secrets necessários (dashboard → Edge Functions → Secrets, ou CLI):

```bash
npx supabase secrets set RESEND_API_KEY=re_...
npx supabase secrets set RESEND_FROM="Doca Livre fazumfreela <seu@dominio-verificado.com>"
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já vêm injetados na função.

Ações da função:

- `acao: "enviar"` — gera código, grava hash em `mao_email_codigos`, envia e-mail
- `acao: "verificar"` — confere código e devolve `verify_token`
- `acao: "consumir"` — invalida o token após concluir cadastro/senha
- `acao: "enviar_legado"` — ainda aceita código enviado pelo cliente (compat)

## 4. Storage

O bucket `mao-documentos` é criado pela migration. Confira em
**Storage** se aparece e se as policies permitem upload com a anon key
(MVP permissivo — restringir depois).

## 5. Como funciona depois do deploy

1. Profissional/empresa conclui o cadastro → grava em `mao_contas` +
   perfil + documentos (arquivo grande vai ao Storage).
2. Admin em qualquer aparelho abre Profissionais/Empresas → o app puxa
   os pendentes do Supabase → **Aprovar** / **Bloquear** / **Excluir**
   atualizam a nuvem.
3. Login consulta a nuvem se a conta não estiver neste navegador e
   respeita o status de aprovação.
4. Sem Supabase configurado, tudo continua só no `localStorage` (seed
   demo intacto).

## 6. Checklist rápido

- [ ] `npx supabase db push`
- [ ] `npx supabase functions deploy enviar-codigo --no-verify-jwt`
- [ ] Secrets `RESEND_API_KEY` e `RESEND_FROM`
- [ ] `VITE_SUPABASE_*` no Render + redeploy
- [ ] Pedir código novo (códigos antigos não valem)
- [ ] Cadastrar num aparelho e aprovar noutro

## 7. Riscos / limitações do MVP

- Senhas ficam como `local:senha` (mesmo padrão do bootstrap). Trocar
  por hash forte antes de produção real.
- RLS está permissivo (`using (true)`) para o MVP com anon key.
- Exclusão de conta remove conta + perfil + documentos; não apaga
  demandas/candidaturas históricas ligadas ao id.
- Superusuários (Diego, Elder) e a conta logada **não** podem ser
  excluídos pelo Admin.
