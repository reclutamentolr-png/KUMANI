-- Fabula: le parole vietate (inserite dallo Staff) diventavano un'espressione
-- regolare così com'erano. Una parola con caratteri speciali, per esempio
-- «(» o «[», faceva fallire il controllo e bloccava tutte le storie. Ora i
-- caratteri speciali valgono come lettere normali.
create or replace function public.fabula_flagged(p_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.fabula_banned_words w
    where lower(coalesce(p_text, '')) ~ ('(^|[^[:alnum:]_])' || regexp_replace(lower(w.word), '([^[:alnum:][:space:]])', '\\\1', 'g'))
  );
$$;
