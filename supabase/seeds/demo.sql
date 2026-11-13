-- Run in the Supabase SQL editor as postgres after applying the migration.
-- Create these four email/password users in Authentication > Users first:
-- admin@smberp.example, manager@smberp.example,
-- alex@smberp.example, jordan@smberp.example
-- Use a development project. This grants demo roles and assigns a demo manager.
-- Existing demo weeks are preserved on reruns; use a fresh project to reset them.
begin;
do $$
#variable_conflict use_column
<<demo>>
declare
  admin_id uuid;
  manager_id uuid;
  employee_id uuid;
  employee_email text;
  project_id uuid;
  activity_id uuid;
  sheet_id uuid;
  monday date;
  week_date date;
  week_offset integer;
  day_offset integer;
  saved_actor text := current_setting('request.jwt.claim.sub', true);
begin
  if (select count(*) from auth.users where email in (
    'admin@smberp.example', 'manager@smberp.example',
    'alex@smberp.example', 'jordan@smberp.example')) <> 4 then
    raise exception 'Create all four demo Auth users listed at the top of demo.sql before loading this seed.';
  end if;
  select id into admin_id from auth.users where email = 'admin@smberp.example';
  select id into manager_id from auth.users where email = 'manager@smberp.example';
  update public.profiles set display_name = 'Demo Administrator', active = true where id = admin_id;
  update public.profiles set display_name = 'Morgan Lee', active = true where id = manager_id;
  insert into public.user_roles(user_id, role) values (admin_id, 'admin'), (manager_id, 'manager')
    on conflict do nothing;

  insert into public.projects(code, name) values
    ('DEMO-WEB', 'Demo · Website redesign'),
    ('DEMO-OPS', 'Demo · Operations improvement') on conflict(code) do nothing;
  insert into public.project_activities(project_id, code, name)
    select p.id, a.code, a.name from public.projects p
    cross join (values ('PLAN', 'Planning and discovery'), ('BUILD', 'Implementation'),
      ('REVIEW', 'Testing and review')) as a(code, name)
    where p.code in ('DEMO-WEB', 'DEMO-OPS')
    on conflict(project_id, code) do nothing;

  select date_trunc('week', now() at time zone business_timezone)::date
    into monday from public.settings;
  foreach employee_email in array array['alex@smberp.example', 'jordan@smberp.example'] loop
    select id into employee_id from auth.users where email = employee_email;
    update public.profiles set display_name = case when employee_email = 'alex@smberp.example'
      then 'Alex Rivera' else 'Jordan Chen' end, manager_id = demo.manager_id, active = true
      where id = employee_id;
    insert into public.project_assignments(employee_id, project_id)
      select employee_id, p.id from public.projects p where p.code in ('DEMO-WEB', 'DEMO-OPS')
      on conflict(employee_id, project_id) do nothing;

    for week_offset in 0..3 loop
      week_date := monday - week_offset * 7;
      if exists(select 1 from public.timesheets t where t.employee_id = demo.employee_id and t.week_start = week_date) then
        continue;
      end if;
      perform set_config('request.jwt.claim.sub', employee_id::text, true);
      sheet_id := public.open_week(week_date);
      for day_offset in 0..4 loop
        -- Current week contains only Monday, so no future dates are inserted.
        exit when week_offset = 0 and day_offset > 0;
        select p.id, a.id into project_id, activity_id
          from public.projects p join public.project_activities a on a.project_id = p.id
          where p.code = case when day_offset % 2 = 0 then 'DEMO-WEB' else 'DEMO-OPS' end
          and a.code = case when day_offset = 0 then 'PLAN' when day_offset = 4 then 'REVIEW' else 'BUILD' end;
        perform public.save_entry(sheet_id, week_date + day_offset, project_id, activity_id,
          case when week_offset = 0 then 0.5 when day_offset = 2 then 8.5 else 7.5 end,
          'Demo: ' || case when day_offset = 0 then 'Discovery and planning'
            when day_offset = 4 then 'Review deliverables' else 'Implementation work' end);
      end loop;
      if week_offset > 0 then
        perform public.submit_week(sheet_id);
      end if;
      if week_offset >= 2 then
        perform set_config('request.jwt.claim.sub', manager_id::text, true);
        perform public.decide_week(sheet_id, 1,
          case when week_offset = 2 then 'returned' else 'approved' end,
          case when week_offset = 2 then 'Please clarify the additional hours on Wednesday.' else null end);
      end if;
    end loop;
  end loop;
  perform set_config('request.jwt.claim.sub', coalesce(saved_actor, ''), true);
end;
$$ language plpgsql;
commit;
