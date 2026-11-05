grant usage on schema public to web;
grant all privileges on all tables in schema public to web;
grant all privileges on all sequences in schema public to web;
alter default privileges in schema public grant all on tables to web;
alter default privileges in schema public grant all on sequences to web;
