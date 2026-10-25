-- Comunicazioni: registro di chi ha già ricevuto l'email, così un invio
-- fermato a metà (limite giornaliero di Resend, errore, tempo scaduto) si
-- completa con «Invia ai mancanti» senza rimandarla a nessuno. E un blocco
-- di 15 minuti contro due invii nello stesso momento.

create table if not exists public.staff_communication_deliveries (
  communication_id uuid not null references public.staff_communications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (communication_id, user_id)
);
alter table public.staff_communication_deliveries enable row level security;

alter table public.staff_communications add column if not exists email_lock_at timestamptz;

-- Sicurezza: se per lo stesso caso c'è già un avviso aperto, si aggiorna quello
-- (prima un avviso risolto di gravità pari o maggiore poteva «assorbire» i
-- nuovi eventi e l'avviso aperto smetteva di contare)
create or replace function public.security_raise(
  p_kind text,
  p_severity text,
  p_key text,
  p_title text,
  p_user uuid default null,
  p_ip text default null,
  p_detail jsonb default '{}'::jsonb
)
returns table (alert_id uuid, severity text, title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_new boolean;
  v_done_id uuid;
  v_done_severity text;
begin
  -- Ignorato di recente: non torna per 7 giorni
  if exists (
    select 1 from public.security_alerts a
    where a.dedupe_key = p_key and a.status = 'ignored' and a.resolved_at > now() - interval '7 days'
  ) then
    return;
  end if;
  -- Già risolto (e nessun avviso aperto per lo stesso caso): resta nell'archivio, a meno che ora sia più grave
  if not exists (select 1 from public.security_alerts a where a.dedupe_key = p_key and a.status = 'open') then
    select a.id, a.severity into v_done_id, v_done_severity
    from public.security_alerts a
    where a.dedupe_key = p_key and a.status = 'resolved'
    order by public.sec_rank(a.severity) desc, coalesce(a.resolved_at, a.last_seen) desc
    limit 1;
    if v_done_id is not null and public.sec_rank(p_severity) <= public.sec_rank(v_done_severity) then
      update public.security_alerts a
        set count = a.count + 1,
            last_seen = now(),
            detail = a.detail || coalesce(p_detail, '{}'::jsonb)
        where a.id = v_done_id;
      return;
    end if;
  end if;
  insert into public.security_alerts as a (kind, severity, dedupe_key, title, user_id, ip, detail)
  values (p_kind, p_severity, p_key, p_title, p_user, p_ip, coalesce(p_detail, '{}'::jsonb))
  on conflict (dedupe_key) where status = 'open' do update
    set count = a.count + 1,
        last_seen = now(),
        title = excluded.title,
        detail = a.detail || excluded.detail,
        severity = case when public.sec_rank(excluded.severity) > public.sec_rank(a.severity) then excluded.severity else a.severity end
  returning a.id, (xmax = 0) into v_id, v_new;
  if v_new then
    return query select v_id, p_severity, p_title;
  end if;
end;
$$;
revoke all on function public.security_raise(text, text, text, text, uuid, text, jsonb) from public, anon, authenticated;
