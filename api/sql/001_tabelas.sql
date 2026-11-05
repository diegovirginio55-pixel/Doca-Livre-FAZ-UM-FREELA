-- Doca Livre fazumfreela — Schema consolidado PostgreSQL

-- Usuários do portal legado
create table if not exists mao_usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique,
  email text not null unique,
  senha_hash text not null,
  role text not null check (role in ('empresa', 'profissional', 'admin', 'super')),
  perfil_id text,
  nivel_hierarquia text not null default 'operador'
    check (nivel_hierarquia in ('super', 'gestor', 'operador')),
  superior_usuario text,
  empresa_org_id text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists mao_usuarios_email_idx on mao_usuarios (lower(email));
create index if not exists mao_usuarios_superior_idx on mao_usuarios (superior_usuario);

-- Códigos OTP de e-mail
create table if not exists mao_email_codigos (
  id uuid primary key default gen_random_uuid(),
  finalidade text not null check (finalidade in ('cadastro', 'senha')),
  email text not null,
  codigo_hash text not null,
  expira_em timestamptz not null,
  usado boolean not null default false,
  verify_token text,
  token_expira_em timestamptz,
  portal_role text check (portal_role is null or portal_role in ('empresa', 'profissional')),
  created_at timestamptz not null default now()
);

create index if not exists mao_email_codigos_email_idx on mao_email_codigos (lower(email), finalidade);
create index if not exists mao_email_codigos_token_idx on mao_email_codigos (verify_token) where verify_token is not null;

-- Permissões por sistema
create table if not exists mao_permissoes (
  id uuid primary key default gen_random_uuid(),
  usuario text not null references mao_usuarios (usuario) on delete cascade,
  sistema text not null check (sistema in ('empresa', 'profissional', 'admin')),
  pode_acessar boolean not null default true,
  modulos jsonb,
  unique (usuario, sistema)
);

-- Níveis de hierarquia
create table if not exists mao_hierarquia_niveis (
  id text primary key,
  label text not null,
  ordem int not null
);

insert into mao_hierarquia_niveis (id, label, ordem) values
  ('super', 'Superusuário', 1),
  ('gestor', 'Gestor', 2),
  ('operador', 'Operador', 3)
on conflict (id) do nothing;

-- Organograma
create table if not exists mao_org_nos (
  id uuid primary key default gen_random_uuid(),
  sistema text not null default 'empresa',
  tipo text not null,
  nome text not null,
  parent_id uuid references mao_org_nos (id) on delete set null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists mao_grupos_hierarquia (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sistema text not null default 'empresa',
  created_at timestamptz not null default now()
);

create table if not exists mao_grupos_hierarquia_membros (
  grupo_id uuid not null references mao_grupos_hierarquia (id) on delete cascade,
  usuario text not null,
  primary key (grupo_id, usuario)
);

create table if not exists mao_app_state (
  id text primary key default 'main',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Contas do app
create table if not exists mao_contas (
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

create index if not exists mao_contas_email_idx on mao_contas (lower(email));
create index if not exists mao_contas_usuario_idx on mao_contas (lower(usuario));

-- Perfis de profissional
create table if not exists mao_profissionais (
  id text primary key,
  user_id text not null references mao_contas (id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'bloqueado', 'recusado')),
  payload jsonb not null default '{}'::jsonb,
  motivo_recusa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mao_profissionais_status_idx on mao_profissionais (status);
create index if not exists mao_profissionais_user_idx on mao_profissionais (user_id);

-- Perfis de empresa
create table if not exists mao_empresas (
  id text primary key,
  user_id text not null references mao_contas (id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'bloqueada', 'recusada')),
  payload jsonb not null default '{}'::jsonb,
  motivo_recusa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mao_empresas_status_idx on mao_empresas (status);
create index if not exists mao_empresas_user_idx on mao_empresas (user_id);

-- Documentos de cadastro
create table if not exists mao_documentos (
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

create index if not exists mao_documentos_dono_idx on mao_documentos (dono_tipo, dono_id);
