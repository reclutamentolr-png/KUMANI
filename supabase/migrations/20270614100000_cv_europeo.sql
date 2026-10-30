-- KUMANI CV: 4 modelli nuovi (Moderno, Professionale, Elegante, Formato
-- europeo) e i dati in più dello standard europeo (Europass): data di
-- nascita, nazionalità, patente, competenze digitali, interessi e frase di
-- consenso al trattamento dei dati (GDPR). I CV già fatti non cambiano.

alter table public.cvs drop constraint if exists cvs_template_check;
alter table public.cvs add constraint cvs_template_check
  check (template in ('minimal', 'classic', 'sidebar', 'moderno', 'professionale', 'elegante', 'europeo'));

alter table public.cvs add column if not exists extras jsonb not null default '{}'::jsonb;
alter table public.cvs drop constraint if exists cvs_extras_check;
alter table public.cvs add constraint cvs_extras_check
  check (jsonb_typeof(extras) = 'object' and char_length(extras::text) <= 6000);

-- Pagina pubblica del CV: ora restituisce anche i dati in più
drop function if exists public.get_cv_by_code(text);
create function public.get_cv_by_code(p_code text)
returns table (
  code text,
  title text,
  template text,
  content_language text,
  full_name text,
  role_title text,
  summary text,
  email text,
  phone text,
  location text,
  photo_path text,
  links jsonb,
  experiences jsonb,
  education jsonb,
  skills jsonb,
  languages jsonb,
  certifications jsonb,
  extras jsonb,
  updated_at timestamptz
)
security definer
set search_path = public
language sql
stable
as $$
  select
    code, title, template, content_language, full_name, role_title, summary,
    email, phone, location, photo_path, links, experiences, education,
    skills, languages, certifications, extras, updated_at
  from cvs
  where code = p_code
    and public.public_page_visible(user_id, 'kumani-cv')
  limit 1;
$$;

grant execute on function public.get_cv_by_code(text) to anon, authenticated;
