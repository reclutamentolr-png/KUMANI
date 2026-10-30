-- LE MIE CANDIDATURE: correzioni dopo il controllo (si può applicare più volte).
--
-- 1. Lo storico dei cambi di stato lo scrive SOLO il database: la funzione del
--    trigger gira come proprietario (security definer), così scrive la riga
--    giusta chiunque cambi lo stato (la persona, lo Staff, il server), e gli
--    utenti non possono più inventare, cambiare o cancellare righe dello
--    storico da soli (prima potevano farlo sulle proprie candidature).
--    Le righe se ne vanno con la candidatura (cascata) o da «I miei dati».
-- 2. «Ultimi 100 cambi»: l'ora di ogni riga è quella vera del momento
--    (clock_timestamp), così in un salvataggio con più cambi non si perde il più
--    recente.
-- 3. L'id e la data di creazione non si possono cambiare né falsare.
-- 4. Link all'annuncio: solo http/https e senza spazi o caratteri di controllo
--    (un a capo finiva nel file .ics del calendario).

-- 1. Storico scritto solo dal trigger -----------------------------------------

drop policy if exists job_application_events_own_insert on public.job_application_events;
drop policy if exists job_application_events_own_update on public.job_application_events;
drop policy if exists job_application_events_own_delete on public.job_application_events;
drop policy if exists job_application_events_plan_insert on public.job_application_events;
drop policy if exists job_application_events_plan_update on public.job_application_events;
revoke insert, update, delete, truncate on public.job_application_events from anon, authenticated;

-- 2. Trigger dello storico -----------------------------------------------------

create or replace function public.job_applications_log_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.job_application_events (user_id, application_id, from_status, to_status, created_at)
    values (new.user_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status, clock_timestamp());

    delete from public.job_application_events e
    where e.application_id = new.id
      and e.id not in (
        select x.id from public.job_application_events x
        where x.application_id = new.id
        order by x.created_at desc, x.id desc
        limit 100
      );
  end if;
  return null;
end;
$$;

revoke all on function public.job_applications_log_status() from public, anon, authenticated;

-- 3. Id e date protetti --------------------------------------------------------

create or replace function public.job_applications_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.status_changed_at := now();
  else
    new.id := old.id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    if new.status is distinct from old.status then
      new.status_changed_at := now();
    else
      new.status_changed_at := old.status_changed_at;
    end if;
  end if;
  return new;
end;
$$;

-- 4. Link all'annuncio ---------------------------------------------------------

alter table public.job_applications drop constraint if exists job_applications_ad_url_check;
alter table public.job_applications add constraint job_applications_ad_url_check
  check (ad_url is null or (char_length(ad_url) <= 500 and ad_url ~* '^https?://[^[:space:][:cntrl:]]+$'));
