-- Aplicativo Android: cada celular ativado ("Ativar neste celular") tem um código próprio, usado pelo widget e
-- pelos avisos para buscar o resumo da conta sem a sessão do navegador. Só o hash do código fica no banco.
-- Tabela interna da API: o papel web (PostgREST) não enxerga nada dela.

create table if not exists mao_app_aparelhos (
  id text primary key,
  conta_id text not null references mao_contas (id) on delete cascade,
  token_hash text not null unique,
  versao text,
  criado_em timestamptz not null default now(),
  visto_em timestamptz
);

create index if not exists mao_app_aparelhos_conta_idx on mao_app_aparelhos (conta_id);

revoke all on mao_app_aparelhos from web;
alter table mao_app_aparelhos enable row level security;
