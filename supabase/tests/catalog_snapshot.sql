-- Read-only catalog snapshot (functions with ACLs, policies, RLS flags, table ACLs) used by CI to prove the rollback restores the pre-migration state exactly.
-- Optional: -v skip='fn(a,b);fn2(c)' leaves those functions out, for a function a LATER migration legitimately redefines.
\if :{?skip}
\else
\set skip ''
\endif
\pset format unaligned
\pset tuples_only on
select '## functions';
select p.oid::regprocedure::text||E'\n'||pg_get_functiondef(p.oid)||E'\nACL='||coalesce(p.proacl::text,'')||' OWNER='||pg_get_userbyid(p.proowner)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and not (p.oid::regprocedure::text = any (string_to_array(:'skip', ';'))) order by p.oid::regprocedure::text;
select '## policies';
select schemaname||'.'||tablename||' | '||policyname||' | '||permissive||' | '||cmd||' | '||roles::text||' | '||coalesce(qual,'-')||' | '||coalesce(with_check,'-') from pg_policies where schemaname in ('public','private','storage') order by 1;
select '## rls flags';
select n.nspname||'.'||c.relname||' rls='||c.relrowsecurity||' force='||c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p') order by 1;
select '## table acl';
select n.nspname||'.'||c.relname||' '||coalesce(c.relacl::text,'') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p','S') order by 1;
