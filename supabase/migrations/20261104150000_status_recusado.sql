-- Permite recusar cadastro (profissional/empresa) e guarda motivo no payload jsonb.
-- motivoRecusa fica em payload; esta migration só libera o status no check.

alter table public.mao_profissionais
  drop constraint if exists mao_profissionais_status_check;

alter table public.mao_profissionais
  add constraint mao_profissionais_status_check
  check (status in ('pendente', 'aprovado', 'bloqueado', 'recusado'));

alter table public.mao_empresas
  drop constraint if exists mao_empresas_status_check;

alter table public.mao_empresas
  add constraint mao_empresas_status_check
  check (status in ('pendente', 'aprovada', 'bloqueada', 'recusada'));

alter table public.mao_profissionais
  add column if not exists motivo_recusa text;

alter table public.mao_empresas
  add column if not exists motivo_recusa text;