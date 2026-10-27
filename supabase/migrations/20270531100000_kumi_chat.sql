-- Chiedi a KUMI: la chat della home per chi visita KUMANI la prima volta
-- (non per gli iscritti, che hanno i messaggi allo Staff). KUMI risponde solo
-- con i testi di KUMANI; le domande senza risposta finiscono in Admin, dove
-- lo Staff può insegnare la risposta.

-- Impostazioni (Admin → Chiedi a KUMI): spenta, solo Staff o accesa;
-- domande al giorno per visitatore e tetto giornaliero delle risposte con l'IA
insert into public.system_settings (key, value)
values ('kumi_chat', '{"mode": "staff", "visitorDaily": 10, "totalDaily": 300}'::jsonb)
on conflict (key) do nothing;

-- Domande del giorno: per visitatore (cookie), per rete (IP) e totale IA.
-- Le chiavi sono impronte (sha256), mai l'IP o il cookie in chiaro.
create table if not exists public.kumi_chat_usage (
  key text not null,
  day date not null,
  n int not null default 0,
  primary key (key, day)
);
alter table public.kumi_chat_usage enable row level security;
revoke all on public.kumi_chat_usage from public, anon, authenticated;

-- Domande fatte (senza dati personali: email, telefoni, IBAN… tolti prima)
create table if not exists public.kumi_chat_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  locale text,
  question text not null,
  answer text,
  -- cache · ai · staff · none (KUMI non sapeva) · limit (domande finite)
  source text not null,
  answered boolean not null default false,
  rating smallint check (rating in (-1, 1)),
  -- Sigla anonima del visitatore (prime cifre dell'impronta del cookie) per
  -- raggruppare le domande della stessa conversazione, e paese della rete
  visitor_tag text,
  country text
);
create index if not exists kumi_chat_questions_created on public.kumi_chat_questions (created_at desc);
alter table public.kumi_chat_questions enable row level security;
revoke all on public.kumi_chat_questions from public, anon, authenticated;

-- Risposte già date, riusate per 7 giorni (stessa domanda, stessa lingua)
create table if not exists public.kumi_chat_cache (
  question_norm text not null,
  locale text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (question_norm, locale)
);
alter table public.kumi_chat_cache enable row level security;
revoke all on public.kumi_chat_cache from public, anon, authenticated;

-- Risposte insegnate dallo Staff: valgono subito per la stessa domanda e
-- fanno parte di quello che KUMI sa per tutte le altre
create table if not exists public.kumi_chat_knowledge (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  question text not null check (char_length(question) <= 300),
  question_norm text not null,
  answer text not null check (char_length(answer) <= 1500),
  locale text
);
create index if not exists kumi_chat_knowledge_norm on public.kumi_chat_knowledge (question_norm);
alter table public.kumi_chat_knowledge enable row level security;
revoke all on public.kumi_chat_knowledge from public, anon, authenticated;

-- Conta una domanda. 'visitor' / 'ip': domanda finita per quel visitatore o
-- quella rete; 'total': tetto dell'IA del giorno raggiunto (solo con p_ai).
create or replace function public.kumi_chat_take(p_visitor text, p_ip text, p_visitor_limit int, p_ip_limit int, p_total_limit int, p_ai boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Europe/Rome')::date;
  v_n int;
begin
  perform pg_advisory_xact_lock(hashtext('kumi_chat_take'));
  select n into v_n from public.kumi_chat_usage where key = 'v:' || p_visitor and day = v_day;
  if coalesce(v_n, 0) >= p_visitor_limit then
    return 'visitor';
  end if;
  if p_ip is not null then
    select n into v_n from public.kumi_chat_usage where key = 'i:' || p_ip and day = v_day;
    if coalesce(v_n, 0) >= p_ip_limit then
      return 'ip';
    end if;
  end if;
  if p_ai then
    select n into v_n from public.kumi_chat_usage where key = 'total' and day = v_day;
    if coalesce(v_n, 0) >= p_total_limit then
      return 'total';
    end if;
    insert into public.kumi_chat_usage (key, day, n) values ('total', v_day, 1)
    on conflict (key, day) do update set n = kumi_chat_usage.n + 1;
  end if;
  insert into public.kumi_chat_usage (key, day, n) values ('v:' || p_visitor, v_day, 1)
  on conflict (key, day) do update set n = kumi_chat_usage.n + 1;
  if p_ip is not null then
    insert into public.kumi_chat_usage (key, day, n) values ('i:' || p_ip, v_day, 1)
    on conflict (key, day) do update set n = kumi_chat_usage.n + 1;
  end if;
  -- Pulizia: oltre 3 giorni non servono
  delete from public.kumi_chat_usage where day < v_day - 3;
  return 'ok';
end;
$$;
revoke all on function public.kumi_chat_take(text, text, int, int, int, boolean) from public, anon, authenticated;
grant execute on function public.kumi_chat_take(text, text, int, int, int, boolean) to service_role;

-- Domande rimaste oggi a un visitatore
create or replace function public.kumi_chat_used(p_visitor text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select n from public.kumi_chat_usage where key = 'v:' || p_visitor and day = (now() at time zone 'Europe/Rome')::date), 0)
$$;
revoke all on function public.kumi_chat_used(text) from public, anon, authenticated;
grant execute on function public.kumi_chat_used(text) to service_role;
