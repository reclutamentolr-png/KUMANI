-- Recensioni: si mostra solo il nome di battesimo, senza il cognome (prima
-- era nome + iniziale del cognome). Stessa funzione di prima, cambia solo il
-- nome mostrato; le recensioni già scritte si aggiornano.

create or replace function public.submit_review(p_subject text, p_rating int, p_title text, p_body text, p_locale text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_label text;
  v_first text;
  v_name text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_logged_in';
  end if;
  v_label := public.review_purchase_label(v_uid, p_subject);
  if v_label is null then
    raise exception 'not_eligible';
  end if;
  select nullif(trim(first_name), '') into v_first from public.profiles where id = v_uid;
  v_name := left(coalesce(initcap(v_first), 'Kumano'), 60);

  insert into public.reviews (user_id, subject, rating, title, body, locale, display_name, purchase_label, status, consent_at)
  values (v_uid, p_subject, p_rating, nullif(trim(p_title), ''), trim(p_body), p_locale, v_name, v_label, 'pending', now())
  on conflict (user_id, subject) do update
    set rating = excluded.rating,
        title = excluded.title,
        body = excluded.body,
        locale = excluded.locale,
        display_name = excluded.display_name,
        purchase_label = excluded.purchase_label,
        status = 'pending',
        reject_reason = null,
        reviewed_at = null,
        reviewed_by = null,
        consent_at = now(),
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_review(text, int, text, text, text) from public, anon;
grant execute on function public.submit_review(text, int, text, text, text) to authenticated;

-- Recensioni già scritte: via l'iniziale del cognome
update public.reviews r
set display_name = left(coalesce(initcap(nullif(trim(p.first_name), '')), 'Kumano'), 60)
from public.profiles p
where p.id = r.user_id;
