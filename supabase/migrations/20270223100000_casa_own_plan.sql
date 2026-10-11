-- KUMANI Casa salva le sue scadenze (con casa_home_id) in life_calendar_items.
-- Finora le regole di Life Calendar valevano anche per loro: se Life Calendar
-- era spento o non incluso nel piano, in Casa le scadenze non si salvavano
-- più (senza errore), e contavano nel limite di elementi di Life Calendar.
-- Ora le righe di Casa seguono il piano di Casa e non contano in quel limite.

drop policy if exists life_calendar_items_plan_insert on public.life_calendar_items;
create policy life_calendar_items_plan_insert on public.life_calendar_items as restrictive for insert to authenticated
  with check (
    case when casa_home_id is not null
      then exists (select 1 from public.can_use_tool('casa') t where t.allowed)
      else exists (select 1 from public.can_use_tool('life-calendar') t where t.allowed)
    end
  );

drop policy if exists life_calendar_items_plan_update on public.life_calendar_items;
create policy life_calendar_items_plan_update on public.life_calendar_items as restrictive for update to authenticated
  using (
    case when casa_home_id is not null
      then exists (select 1 from public.can_use_tool('casa') t where t.allowed)
      else exists (select 1 from public.can_use_tool('life-calendar') t where t.allowed)
    end
  );

-- Limite di Life Calendar: si contano e si controllano solo le sue scadenze
drop trigger if exists app_limit_check on public.life_calendar_items;
create trigger app_limit_check before insert on public.life_calendar_items
  for each row
  when (new.casa_home_id is null)
  execute function public.enforce_app_limit('lifecal_items', 'user_id', 'status = ''active'' and casa_home_id is null');
