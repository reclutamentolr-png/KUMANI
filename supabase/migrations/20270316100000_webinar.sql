-- KUMANI Webinar (in prova): chi organizza (Pro) va in diretta con video e
-- schermo, chi guarda (anche ospite dal link) ascolta e scrive in chat.
-- Il video passa dal server di Cloudflare (Realtime SFU); qui restano solo
-- i webinar, chi è collegato e la chat. Tutto si legge e scrive dalle azioni
-- del server (chiave di servizio): nessuna regola per il browser.

-- In prova la pagina stessa ammette solo Staff e tester (anche senza Pro):
-- al lancio required_plan diventa 'pro'
insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('webinar', true, 'free', 'KUMANI Webinar – dirette con chat (in prova: solo Staff e tester)')
on conflict (tool_name) do update set required_plan = excluded.required_plan, description = excluded.description;

-- Chi può provarlo oltre allo Staff (finché è in prova)
create table if not exists public.webinar_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.webinars (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  -- Chiave del canale Realtime: solo per chi è entrato
  channel_key text not null default encode(gen_random_bytes(16), 'hex'),
  title text not null check (char_length(title) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  starts_at timestamptz not null,
  seats int not null default 20 check (seats between 1 and 500),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  -- Diretta: sessione Cloudflare di chi presenta e tracce pubblicate
  host_session text,
  host_tracks jsonb not null default '{}'::jsonb,
  host_seen_at timestamptz,
  host_paused boolean not null default false,
  cam_on boolean not null default true,
  screen_on boolean not null default false,
  -- Spettatore con la parola (microfono)
  speaker_id uuid,
  speaker_session text,
  speaker_track text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists webinars_host_idx on public.webinars (host_id, starts_at desc);

create table if not exists public.webinar_viewers (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  -- Il browser tiene il segreto, qui solo l'impronta
  token_hash text not null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 40),
  session_id text,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  hand_raised_at timestamptz,
  last_message_at timestamptz,
  banned boolean not null default false,
  unique (webinar_id, token_hash)
);
create index if not exists webinar_viewers_live_idx on public.webinar_viewers (webinar_id, last_seen desc);

create table if not exists public.webinar_messages (
  id bigint generated always as identity primary key,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  viewer_id uuid references public.webinar_viewers(id) on delete cascade,
  is_host boolean not null default false,
  name text not null,
  body text not null check (char_length(body) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists webinar_messages_idx on public.webinar_messages (webinar_id, id);

-- Solo le azioni del server (chiave di servizio) toccano queste tabelle
alter table public.webinar_testers enable row level security;
alter table public.webinars enable row level security;
alter table public.webinar_viewers enable row level security;
alter table public.webinar_messages enable row level security;

-- Pulizia: webinar finiti da più di 30 giorni (con spettatori e chat);
-- dirette rimaste «in onda» senza chi presenta da 3 ore vengono chiuse
create or replace function public.cleanup_webinars()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.webinars
  set status = 'ended', ended_at = now(), host_session = null, speaker_id = null, speaker_session = null, speaker_track = null
  where status = 'live' and coalesce(host_seen_at, started_at) < now() - interval '3 hours';
  delete from public.webinars
  where (status = 'ended' and ended_at < now() - interval '30 days')
     or (status = 'scheduled' and starts_at < now() - interval '30 days');
end;
$$;
revoke all on function public.cleanup_webinars() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('cleanup-webinars') where exists (select 1 from cron.job where jobname = 'cleanup-webinars');
    perform cron.schedule('cleanup-webinars', '17 * * * *', 'select public.cleanup_webinars()');
  end if;
end;
$$;
