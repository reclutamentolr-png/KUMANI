-- PASS LAVORO: il Pass di KUMANI CV o di Trova Lavoro apre anche tutti gli
-- altri servizi di «Cerco o ho un lavoro» (Lettera di presentazione, Le mie
-- candidature, Registro ore, Note spese, Ricevuta occasionale e l'altro dei due).
-- Stesso elenco nel sito: src/lib/passBundles.ts. Nessun pass esistente cambia:
-- cambia solo per quali servizi vale.

create or replace function public.pass_bundle_tools(p_tool text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case
    when p_tool in ('kumani-cv', 'trova-lavoro') then
      array['trova-lavoro', 'kumani-cv', 'lettera-presentazione', 'candidature', 'registro-ore', 'note-spese', 'ricevuta-occasionale']
    else array[p_tool]
  end;
$$;

-- Un pass vale per il suo servizio e per quelli del suo gruppo
create or replace function public.has_tool_pass(p_user_id uuid, p_tool text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tool_passes
    where user_id = p_user_id and p_tool = any(public.pass_bundle_tools(tool)) and revoked_at is null
      and starts_at <= now() and expires_at > now()
  );
$$;

-- I pass attivi di chi chiama, anche per i servizi aperti dal gruppo (con la
-- scadenza del pass che li apre): così il sito mostra i servizi come aperti
create or replace function public.my_tool_passes()
returns table (tool text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select covered.tool, max(p.expires_at)
  from public.tool_passes p
  cross join lateral unnest(public.pass_bundle_tools(p.tool)) as covered(tool)
  where p.user_id = auth.uid() and p.revoked_at is null and p.expires_at > now()
  group by covered.tool;
$$;
