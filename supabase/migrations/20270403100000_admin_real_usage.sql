-- Admin → «Uso reale»: quanti iscritti usano davvero KUMANI, quanto spesso
-- tornano, quali servizi si aprono (e quali no) e quanti diventano paganti.
-- Attività = un giorno in cui la persona ha avuto una sessione
-- (user_sessions), ha aperto un servizio (tool_opens) o ha fatto l'accesso
-- giornaliero (profiles.last_daily_login). Fuori dai conti: Staff, ospiti in
-- prova, account bloccati o cancellati. Solo lettura, solo chiave di servizio.

create or replace function public.admin_real_usage(p_days int default 30)
returns jsonb
language plpgsql
-- volatile: usa tabelle temporanee per non ricalcolare l'attività
security definer
set search_path = public
as $$
declare
  v_days int := case when p_days in (7, 30, 90) then p_days else 30 end;
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_result jsonb;
begin
  create temporary table if not exists _people (id uuid primary key, signup date, plan text) on commit drop;
  create temporary table if not exists _act (user_id uuid, day date, primary key (user_id, day)) on commit drop;
  truncate _people, _act;

  insert into _people
  select p.id, (p.created_at at time zone 'Europe/Rome')::date, public.plan_of(p.id)
  from public.profiles p
  where p.guest_until is null and p.deleted_at is null and not coalesce(p.is_blocked, false)
    and not public.admin_is_staff(p.id);

  insert into _act
  select distinct a.user_id, a.day
  from (
    select user_id, (started_at at time zone 'Europe/Rome')::date as day from public.user_sessions
    union all
    select user_id, (last_active_at at time zone 'Europe/Rome')::date from public.user_sessions
    union all
    select user_id, opened_on from public.tool_opens
    union all
    select id, last_daily_login from public.profiles where last_daily_login is not null
  ) a
  join _people pe on pe.id = a.user_id
  where a.day is not null and a.day <= v_today
  on conflict do nothing;

  select jsonb_build_object(
    'today', v_today,
    'days', v_days,
    -- Da quando ci sono i dati di attività
    'data_since', least((select min((started_at at time zone 'Europe/Rome')::date) from public.user_sessions), (select min(opened_on) from public.tool_opens)),
    'totals', jsonb_build_object(
      'registered', (select count(*) from _people),
      'free', (select count(*) from _people where plan = 'none'),
      'base', (select count(*) from _people where plan = 'base'),
      'pro', (select count(*) from _people where plan = 'pro')
    ),
    -- Persone attive in un periodo (e nel periodo precedente, per il confronto)
    'active', jsonb_build_object(
      'd1', (select count(distinct user_id) from _act where day = v_today),
      'd7', (select count(distinct user_id) from _act where day > v_today - 7),
      'd30', (select count(distinct user_id) from _act where day > v_today - 30),
      'd90', (select count(distinct user_id) from _act where day > v_today - 90),
      'prev7', (select count(distinct user_id) from _act where day > v_today - 14 and day <= v_today - 7),
      'prev30', (select count(distinct user_id) from _act where day > v_today - 60 and day <= v_today - 30),
      -- media giornaliera negli ultimi 30 giorni (per «quanto è abitudine»)
      'avg_daily30', (select round(count(*)::numeric / 30, 1) from _act where day > v_today - 30)
    ),
    -- Quanti giorni su 30 tornano gli attivi del mese
    'frequency', (
      select jsonb_build_object(
        'one', count(*) filter (where n = 1),
        'two_three', count(*) filter (where n between 2 and 3),
        'four_nine', count(*) filter (where n between 4 and 9),
        'ten_plus', count(*) filter (where n >= 10)
      )
      from (select user_id, count(*) n from _act where day > v_today - 30 group by user_id) f
    ),
    -- Giorno per giorno: attivi e nuovi iscritti
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'active', (select count(*) from _act a where a.day = d.day),
        'signups', (select count(*) from _people p where p.signup = d.day)
      ) order by d.day), '[]'::jsonb)
      from (select generate_series(v_today - (v_days - 1), v_today, interval '1 day')::date as day) d
    ),
    -- Iscritti per settimana (lunedì): attivi nella prima settimana, tornati
    -- dall'8° al 30° giorno, attivi negli ultimi 30 giorni
    'cohorts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week', c.week,
        'signups', c.signups,
        'first_week', c.first_week,
        'came_back', c.came_back,
        'active_now', c.active_now,
        'mature', c.week + 30 <= v_today
      ) order by c.week desc), '[]'::jsonb)
      from (
        select date_trunc('week', p.signup)::date as week,
          count(*) as signups,
          count(*) filter (where exists (select 1 from _act a where a.user_id = p.id and a.day between p.signup and p.signup + 6)) as first_week,
          count(*) filter (where exists (select 1 from _act a where a.user_id = p.id and a.day between p.signup + 7 and p.signup + 30)) as came_back,
          count(*) filter (where exists (select 1 from _act a where a.user_id = p.id and a.day > v_today - 30)) as active_now
        from _people p
        where p.signup > v_today - 84
        group by 1
      ) c
    ),
    -- Tutti i servizi, anche quelli mai aperti (persone diverse nel periodo)
    'tools', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tool', m.tool_name,
        'enabled', coalesce(m.is_enabled, true),
        'plan', coalesce(nullif(m.required_plan, ''), 'free'),
        'users', coalesce(u.users, 0),
        'use_days', coalesce(u.use_days, 0),
        'prev_users', coalesce(pv.users, 0)
      ) order by coalesce(u.users, 0) desc, coalesce(u.use_days, 0) desc, m.tool_name), '[]'::jsonb)
      from public.marketplace_settings m
      left join (
        select t.tool_name, count(distinct t.user_id) users, count(*) use_days
        from public.tool_opens t join _people pe on pe.id = t.user_id
        where t.opened_on > v_today - v_days
        group by t.tool_name
      ) u on u.tool_name = m.tool_name
      left join (
        select t.tool_name, count(distinct t.user_id) users
        from public.tool_opens t join _people pe on pe.id = t.user_id
        where t.opened_on > v_today - 2 * v_days and t.opened_on <= v_today - v_days
        group by t.tool_name
      ) pv on pv.tool_name = m.tool_name
    ),
    -- Piani e conversione
    'conversion', jsonb_build_object(
      'signups90', (select count(*) from _people where signup > v_today - 90),
      'paying_from_signups90', (select count(*) from _people where signup > v_today - 90 and plan in ('base', 'pro')),
      'avg_days_to_pay', (
        select round(avg(greatest(0, (p.subscription_started_at at time zone 'Europe/Rome')::date - pe.signup))::numeric, 1)
        from _people pe join public.profiles p on p.id = pe.id
        where pe.plan in ('base', 'pro') and p.subscription_started_at is not null
      ),
      'checkouts_by_month', (
        select coalesce(jsonb_agg(jsonb_build_object('month', x.month, 'base', x.base, 'pro', x.pro) order by x.month), '[]'::jsonb)
        from (
          select date_trunc('month', s.created_at at time zone 'Europe/Rome')::date as month,
            count(*) filter (where s.plan = 'base') as base,
            count(*) filter (where s.plan = 'pro') as pro
          from public.subscription_consents s join _people pe on pe.id = s.user_id
          where s.kind in ('checkout', 'upgrade') and s.created_at > now() - interval '6 months'
          group by 1
        ) x
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_real_usage(int) from public, anon, authenticated;
grant execute on function public.admin_real_usage(int) to service_role;
