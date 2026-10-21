-- Promozione di lancio: quando si prende l'ultimo posto il database segna
-- l'ora (founders_full_at). Il banner «posti esauriti in N ore» la confronta
-- con l'accensione (founders_started_at) e resta 48 ore.

create or replace function public.founders_mark_full()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.counted and new.number >= public.setting_int('founders_limit', 50) then
    insert into public.system_settings (key, value, updated_at)
    values ('founders_full_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now())
    on conflict (key) do nothing;
  end if;
  return new;
end;
$function$;
drop trigger if exists founders_mark_full on public.founder_members;
create trigger founders_mark_full after insert on public.founder_members for each row execute function public.founders_mark_full();
revoke execute on function public.founders_mark_full() from public, anon, authenticated;

-- Accensione della promozione (21/10/2026 06:50 ora italiana)
insert into public.system_settings (key, value, updated_at)
values ('founders_started_at', '2026-10-21T04:50:23Z', now())
on conflict (key) do nothing;
