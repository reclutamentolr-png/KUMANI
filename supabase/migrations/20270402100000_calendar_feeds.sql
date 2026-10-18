-- Calendario KUMANI da collegare a Google Calendar, iPhone e Outlook: ogni
-- utente ha un link personale e segreto (/api/calendario/<token>.ics) con i
-- suoi impegni (serate Convivium, eventi, viaggi, MemoLife, bollette,
-- scadenze). Solo lettura, da KUMANI verso il calendario. Il link si può
-- rigenerare: quello vecchio smette subito di funzionare.

create table if not exists public.calendar_feeds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique check (token ~ '^[a-f0-9]{48}$'),
  locale text not null default 'it' check (locale in ('it', 'en', 'de', 'es', 'fr', 'pt', 'ru')),
  created_at timestamptz not null default now(),
  last_fetched_at timestamptz
);

-- Nessun accesso diretto: il link si legge con la chiave di servizio, il
-- token si crea o si rigenera solo con calendar_feed_token
alter table public.calendar_feeds enable row level security;
revoke all on public.calendar_feeds from anon, authenticated;

-- Il mio link (lo crea se non c'è). p_rotate = true: nuovo token, il vecchio
-- link smette di funzionare. Torna il token e quando è stato letto l'ultima volta.
create or replace function public.calendar_feed_token(p_rotate boolean default false, p_locale text default 'it')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_locale text := case when p_locale in ('it', 'en', 'de', 'es', 'fr', 'pt', 'ru') then p_locale else 'it' end;
  v_row public.calendar_feeds%rowtype;
  v_token text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_row from public.calendar_feeds where user_id = v_uid;
  if v_row.user_id is not null and not coalesce(p_rotate, false) then
    if v_row.locale <> v_locale then
      update public.calendar_feeds set locale = v_locale where user_id = v_uid;
    end if;
    return jsonb_build_object('token', v_row.token, 'last_fetched_at', v_row.last_fetched_at);
  end if;
  v_token := md5(gen_random_uuid()::text) || substr(md5(gen_random_uuid()::text), 1, 16);
  insert into public.calendar_feeds (user_id, token, locale) values (v_uid, v_token, v_locale)
  on conflict (user_id) do update set token = excluded.token, locale = excluded.locale, created_at = now(), last_fetched_at = null;
  return jsonb_build_object('token', v_token, 'last_fetched_at', null);
end;
$$;
revoke all on function public.calendar_feed_token(boolean, text) from public, anon;
grant execute on function public.calendar_feed_token(boolean, text) to authenticated;
