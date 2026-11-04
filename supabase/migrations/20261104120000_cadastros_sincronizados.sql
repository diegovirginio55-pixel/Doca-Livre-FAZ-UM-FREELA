-- Cadastros sincronizados (profissional / empresa / contas / documentos)
-- Permite que cadastro e aprovação funcionem entre aparelhos via Supabase.

-- Contas do app (ids texto iguais aos do localStorage)
create table if not exists public.mao_contas (
  id text primary key,
  usuario text unique,
  email text not null unique,
  senha_hash text not null,
  role text not null check (role in ('empresa', 'profissional', 'admin', 'super')),
  nivel_hierarquia text not null default 'operador'
    check (nivel_hierarquia in ('super', 'gestor', 'operador')),
  superior_usuario text,
  perfil_completo boolean not null default false,
  ativo boolean not null default true,
  aceites jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mao_contas_email_idx on public.mao_contas (lower(email));
create index if not exists mao_contas_usuario_idx on public.mao_contas (lower(usuario));

-- Perfis de profissional
create table if not exists public.mao_profissionais (
  id text primary key,
  user_id text not null references public.mao_contas (id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'bloqueado')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mao_profissionais_status_idx on public.mao_profissionais (status);
create index if not exists mao_profissionais_user_idx on public.mao_profissionais (user_id);

-- Perfis de empresa
create table if not exists public.mao_empresas (
  id text primary key,
  user_id text not null references public.mao_contas (id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'bloqueada')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mao_empresas_status_idx on public.mao_empresas (status);
create index if not exists mao_empresas_user_idx on public.mao_empresas (user_id);

-- Documentos de cadastro (metadados; arquivo grande vai ao Storage quando houver)
create table if not exists public.mao_documentos (
  id text primary key,
  tipo_id text not null,
  dono_tipo text not null check (dono_tipo in ('profissional', 'empresa', 'ett')),
  dono_id text not null,
  status text not null default 'em_analise'
    check (status in ('pendente', 'em_analise', 'aprovado', 'recusado', 'vencido')),
  arquivo_nome text,
  arquivo_path text,
  arquivo_dados text,
  validade text,
  enviado_em timestamptz not null default now(),
  revisado_em timestamptz,
  revisado_por text,
  observacao text,
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mao_documentos_dono_idx on public.mao_documentos (dono_tipo, dono_id);

-- OTP: token de verificação pós-código (entre aparelhos)
alter table public.mao_email_codigos
  add column if not exists verify_token text,
  add column if not exists token_expira_em timestamptz,
  add column if not exists portal_role text
    check (portal_role is null or portal_role in ('empresa', 'profissional'));

create index if not exists mao_email_codigos_token_idx
  on public.mao_email_codigos (verify_token)
  where verify_token is not null;

-- RLS (MVP permissivo com anon key; restringir depois)
alter table public.mao_contas enable row level security;
alter table public.mao_profissionais enable row level security;
alter table public.mao_empresas enable row level security;
alter table public.mao_documentos enable row level security;

do $$ begin
  create policy mao_contas_all on public.mao_contas for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy mao_profissionais_all on public.mao_profissionais for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy mao_empresas_all on public.mao_empresas for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy mao_documentos_all on public.mao_documentos for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy mao_email_codigos_service on public.mao_email_codigos for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Bucket de documentos (privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mao-documentos',
  'mao-documentos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit;

do $$ begin
  create policy mao_documentos_storage_all
    on storage.objects for all
    using (bucket_id = 'mao-documentos')
    with check (bucket_id = 'mao-documentos');
exception when duplicate_object then null; end $$;