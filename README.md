# Doca Livre fazumfreela

Plataforma de força de trabalho para logística — marketplace operacional para conectar empresas a profissionais (motoristas, armazém, equipamentos, manutenção e administrativo).

## Rodar em localhost

```bash
npm install
npm run dev
```

Abra o endereço do Vite (geralmente `http://localhost:5173`).

## Painel Empresa (estilo Painel PX)

Login: `empresa@logexpress.com` / `demo123`

Menu lateral branco com:
- **Início** — CTA contratar, resumo financeiro, campanhas, Cruzeiro
- **Operacional** — Contratos + Prestadores (favoritos/bloqueados)
- **Ocorrências** — Infrações + Sinistros
- **Financeiro** — Finanças, Campanhas, Calculadora
- **Relatórios** — Relatório operacional
- **Modelos** — Operações, Perfis ideais, Endereços, Veículos

## Contas demo

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Admin | admin@docalivre.com | admin123 |
| Empresa (Log Express) | empresa@logexpress.com | demo123 |
| Empresa (CD Cajamar) | rh@cdcajamar.com | demo123 |
| Profissional (motorista) | joao@email.com | demo123 |
| Profissional (empilhadeira) | carlos@email.com | demo123 |
| Profissional (conferente) | maria@email.com | demo123 |

No painel admin há o botão **Reset demo** para restaurar o seed.

## Fluxo ponta a ponta

1. Entre como **empresa** → Nova demanda → Publicar  
2. Entre como **profissional** compatível → Vagas → Candidatar-se  
3. Volte na empresa → Candidatos → Aceitar  
4. No profissional → Agenda → Check-in / Check-out  
5. Finalize a demanda na empresa (libera pagamento mock)  
6. Avalie nos respectivos painéis  

## Stack (MVP)

- Vite + React 19 + TypeScript  
- Persistência em `localStorage` (sem backend)  
- Identidade visual Doca Livre (logo, splash, amarelo `#f9db00`, sidebar)

## Fase 2 (ainda não conectado)

- Supabase (auth + banco)  
- GitHub  
- Render  

Placeholders em `.env.example`.
