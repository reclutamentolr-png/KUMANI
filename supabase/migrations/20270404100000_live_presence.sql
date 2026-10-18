-- Admin → Uso reale → «In questo momento»: quante persone sono sul sito e in
-- quale pagina. Ogni scheda aperta manda un segnale ogni 45 secondi con un
-- codice casuale della scheda (niente cookie, niente IP, niente nome): chi
-- non manda segnali da 2 minuti esce dal conteggio. Staff escluso. I segnali
-- più vecchi di un giorno si cancellano da soli.

create table if not exists public.live_presence (
  id text primary key check (id ~ '^[a-z0-9]{16,40}$'),
  page text not null check (char_length(page) between 1 and 120),
  member boolean not null default false,
  device text not null default 'desktop' check (device in ('mobile', 'desktop')),
  last_seen timestamptz not null default now()
);
create index if not exists live_presence_last_seen on public.live_presence(last_seen);

-- Nessun accesso diretto: si scrive solo con presence_ping, si legge solo
-- dall'Admin (chiave di servizio)
alter table public.live_presence enable row level security;
revoke all on public.live_presence from anon, authenticated;

create or replace function public.presence_ping(p_id text, p_page text, p_device text default 'desktop')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_id !~ '^[a-z0-9]{16,40}$' or p_page !~ '^/[a-z0-9/:._-]{0,119}$' then
    return;
  end if;
  -- Lo Staff non conta (come nelle sessioni)
  if v_uid is not null and public.admin_is_staff(v_uid) then
    return;
  end if;
  insert into public.live_presence (id, page, member, device, last_seen)
  values (p_id, p_page, v_uid is not null, case when p_device = 'mobile' then 'mobile' else 'desktop' end, now())
  on conflict (id) do update set page = excluded.page, member = excluded.member, device = excluded.device, last_seen = now();
  -- Pulizia ogni tanto: i segnali di più di un giorno non servono
  if random() < 0.02 then
    delete from public.live_presence where last_seen < now() - interval '1 day';
  end if;
end;
$$;
revoke all on function public.presence_ping(text, text, text) from public;
grant execute on function public.presence_ping(text, text, text) to anon, authenticated;

-- Chi è sul sito adesso (segnale negli ultimi 2 minuti), per pagina
create or replace function public.admin_live_presence()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with now_on as (
    select * from public.live_presence where last_seen > now() - interval '2 minutes'
  )
  select jsonb_build_object(
    'total', (select count(*) from now_on),
    'members', (select count(*) from now_on where member),
    'visitors', (select count(*) from now_on where not member),
    'mobile', (select count(*) from now_on where device = 'mobile'),
    'desktop', (select count(*) from now_on where device = 'desktop'),
    'last_hour', (select count(*) from public.live_presence where last_seen > now() - interval '1 hour'),
    'pages', (
      select coalesce(jsonb_agg(jsonb_build_object('page', page, 'total', total, 'members', members) order by total desc, page), '[]'::jsonb)
      from (select page, count(*) total, count(*) filter (where member) members from now_on group by page) p
    )
  );
$$;
revoke all on function public.admin_live_presence() from public, anon, authenticated;
grant execute on function public.admin_live_presence() to service_role;
