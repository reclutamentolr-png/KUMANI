-- Cinque nuovi servizi che lavorano solo nel browser (nessun dato salvato,
-- a parte il punto KU giornaliero): piano richiesto di ciascuno e punti.
insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description) values
  ('documento-sicuro', true, 'base', 'Documento Sicuro – filigrana, oscuramento e rimozione dati nascosti dalle foto dei documenti'),
  ('verifica-iban', true, 'free', 'Verifica IBAN – controllo dell''IBAN prima di un bonifico'),
  ('firma-email', true, 'pro', 'Firma Email – firma professionale per Gmail e Outlook'),
  ('calcolatrici', true, 'pro', 'Calcolatrici PRO – IVA, ritenuta, sconti, ricarico e margine'),
  ('focus', true, 'free', 'KUMANI Focus – timer di concentrazione con pause')
on conflict (tool_name) do nothing;

-- Punti KU giornalieri anche per i nuovi servizi (ultima versione + i 5 nomi)
CREATE OR REPLACE FUNCTION public.award_tool_point(p_tool_name text)
 RETURNS TABLE(awarded boolean, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_rows int;
  v_balance int;
begin
  if auth.uid() is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula',
    'checkmail', 'oxygen',
    'documento-sicuro', 'verifica-iban', 'firma-email', 'calcolatrici', 'focus'
  ) then
    return;
  end if;

  -- Niente punti per strumenti non inclusi nel piano (evita di raccogliere
  -- KU chiamando la funzione direttamente senza usare lo strumento).
  if not exists (select 1 from public.tool_access(auth.uid(), p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (auth.uid(), p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + 1,
      ku_earned_total = coalesce(ku_earned_total, 0) + 1
  where id = auth.uid()
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;
