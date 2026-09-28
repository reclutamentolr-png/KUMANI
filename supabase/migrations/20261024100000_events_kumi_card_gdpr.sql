-- Cancellazione account (GDPR) ed Events fase 3: le tessere Kumi Card
-- create dai check-in agli eventi sono collegate all'account
-- (fidelity_members.user_id). Quando account_anonymize segna il profilo come
-- cancellato, le tessere del partecipante spariscono anche dalle Kumi Card
-- degli organizzatori (nome, timbri e storico).

create or replace function public.profiles_deleted_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fidelity_members where user_id = new.id;
  return new;
end;
$$;
revoke all on function public.profiles_deleted_cleanup() from public, anon, authenticated;

drop trigger if exists profiles_deleted_cleanup on public.profiles;
create trigger profiles_deleted_cleanup
  after update of deleted_at on public.profiles
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.profiles_deleted_cleanup();
