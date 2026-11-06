# Doca Livre fazumfreela

Plataforma de força de trabalho para logística — marketplace operacional para conectar empresas a profissionais (motoristas, armazém, equipamentos, manutenção e administrativo).

## Rodar em localhost

```bash
npm install
npm run dev
```

Abra o endereço do Vite (geralmente `http://localhost:5173`).

O site local usa a API real (Azure). Para explorar sem tocar em dados reais, use **Ver demonstração** na tela inicial: dados fictícios, só no seu navegador. As contas de demonstração aparecem na própria tela de login do modo demo.

## Como funciona

- **Login e senhas** ficam na API (`api/`): a senha é guardada em hash, o login devolve um token de sessão e o banco só mostra a cada pessoa o que é dela (empresa vê os profissionais aprovados; profissional vê as vagas; admin vê tudo).
- **Cadastro**: portal Empresa ou Profissional → *Criar conta* → código por e-mail → formulário → aprovação no Admin.
- **Marketplace**: vagas, candidaturas, contratos, ponto, pagamentos e avaliações vão para o banco e aparecem em qualquer aparelho.
- **Admin**: aprova/recusa cadastros (com e-mail), abre os documentos, gera senha provisória para quem perdeu o acesso.

## Fluxo ponta a ponta

1. **Empresa** publica a vaga (ou convida profissionais encontrados na busca).
2. **Profissional** vê a vaga, se candidata ou aceita o convite.
3. **Empresa** aprova a candidatura → contrato e documentos da missão.
4. **Profissional** registra entrada e saída em cada dia da missão.
5. **Empresa** encerra a missão (Documentação → Encerrar) → pagamento pelos dias com presença e recibo.
6. Os dois avaliam.

## Stack

- Vite + React 19 + TypeScript (site, publicado no Render)
- API Node + PostgREST + PostgreSQL + Azure Blob (pasta `api/`, publicada no Azure Container Apps)

Publicação e variáveis: veja `DEPLOY.md`.
