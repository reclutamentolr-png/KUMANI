-- Comunicazioni nelle 7 lingue: la lingua di ogni iscritto (quella in cui usa
-- KUMANI, salvata dal sito) e le traduzioni di ogni comunicazione. Chi non ha
-- la sua lingua tra le traduzioni la riceve in inglese; chi non ha ancora una
-- lingua salvata la riceve in italiano.

alter table public.profiles add column if not exists locale text;
alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles add constraint profiles_locale_check check (locale is null or locale in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru'));

-- Il sito salva la lingua della persona collegata (solo la sua, solo questa colonna)
create or replace function public.set_my_locale(p_locale text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_locale is null or p_locale not in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru') then
    return;
  end if;
  update public.profiles set locale = p_locale where id = auth.uid() and locale is distinct from p_locale;
end;
$$;
revoke all on function public.set_my_locale(text) from public, anon;
grant execute on function public.set_my_locale(text) to authenticated;

-- Traduzioni: { "en": { "push_title", "push_body", "email_subject", "email_preheader", "email_body" }, ... }
alter table public.staff_communications add column if not exists translations jsonb not null default '{}'::jsonb;
