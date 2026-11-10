-- Acesso do papel web (PostgREST). As permissões por tabela e as regras por usuário
-- ficam em 003_seguranca.sql. Antes este arquivo dava ALL em todas as tabelas.
grant usage on schema public to web;
