begin;
create table public.profiles (
  id uuid primary key references auth.users(id),
  display_name text not null check (length(trim(display_name)) > 0),
  manager_id uuid references public.profiles(id),
  active boolean not null default true,
  check (manager_id is distinct from id)
);
create table public.user_roles (
  user_id uuid not null references public.profiles(id),
  role text not null check (role in ('employee','manager','admin')),
  primary key(user_id, role)
);
create table public.settings (
  id boolean primary key default true check(id),
  business_timezone text not null default 'America/New_York'
);
insert into public.settings default values;
create table public.projects (
  id uuid primary key default gen_random_uuid(), code text not null unique check(length(trim(code)) > 0),
  name text not null check(length(trim(name)) > 0), active boolean not null default true
);
create table public.project_activities (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  code text not null check(length(trim(code)) > 0), name text not null check(length(trim(name)) > 0),
  active boolean not null default true, unique(project_id, code), unique(id, project_id)
);
create table public.project_assignments (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.profiles(id),
  project_id uuid not null references public.projects(id), active boolean not null default true,
  unique(employee_id, project_id)
);
create table public.timesheets (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.profiles(id),
  week_start date not null check(extract(isodow from week_start) = 1),
  status text not null default 'draft' check(status in ('draft','submitted','returned','approved')),
  approver_id uuid references public.profiles(id), version integer not null default 0,
  submitted_at timestamptz, decided_at timestamptz, created_at timestamptz not null default now(),
  unique(employee_id, week_start), check(approver_id is distinct from employee_id)
);
create table public.time_entries (
  id uuid primary key default gen_random_uuid(), timesheet_id uuid not null references public.timesheets(id),
  work_date date not null, project_id uuid not null references public.projects(id), activity_id uuid not null,
  hours numeric not null check(hours > 0 and hours = round(hours,2) and hours::text not in ('NaN','Infinity','-Infinity')),
  description text not null default '',
  foreign key(activity_id, project_id) references public.project_activities(id, project_id),
  unique(timesheet_id,work_date,project_id,activity_id)
);
create table public.timesheet_events (
  id uuid primary key default gen_random_uuid(), timesheet_id uuid not null references public.timesheets(id),
  actor_id uuid not null references public.profiles(id), kind text not null check(kind in ('submitted','returned','approved')),
  version integer not null, reason text, created_at timestamptz not null default now(),
  check(kind <> 'returned' or length(trim(reason)) > 0), check(kind <> 'returned' or reason is not null)
);
create index on public.timesheets(approver_id,status);
create index on public.time_entries(timesheet_id);
create index on public.timesheet_events(timesheet_id,created_at);
create index on public.project_assignments(project_id);

create function public.is_active() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active);
$$;
create function public.has_role(wanted text) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active() and exists(select 1 from public.user_roles where user_id=auth.uid() and role=wanted);
$$;
create function public.can_read_sheet(sheet uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active() and exists(select 1 from public.timesheets where id=sheet and
    (employee_id=auth.uid() or (approver_id=auth.uid() and public.has_role('manager'))));
$$;
create function public.can_read_project(project uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active() and (public.has_role('admin') or
    exists(select 1 from public.project_assignments where employee_id=auth.uid() and project_id=project and active) or
    exists(select 1 from public.time_entries e where e.project_id=project and public.can_read_sheet(e.timesheet_id)));
$$;
create function public.can_read_profile(person uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active() and (person=auth.uid() or public.has_role('admin') or
    exists(select 1 from public.profiles where id=auth.uid() and manager_id=person) or
    exists(select 1 from public.timesheets where employee_id=person and approver_id=auth.uid() and public.has_role('manager')));
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.settings enable row level security;
alter table public.projects enable row level security;
alter table public.project_activities enable row level security;
alter table public.project_assignments enable row level security;
alter table public.timesheets enable row level security;
alter table public.time_entries enable row level security;
alter table public.timesheet_events enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(public.can_read_profile(id));
create policy profiles_admin on public.profiles for update to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy roles_read on public.user_roles for select to authenticated using(user_id=auth.uid() or public.has_role('admin'));
create policy roles_admin on public.user_roles for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy settings_read on public.settings for select to authenticated using(public.is_active());
create policy projects_read on public.projects for select to authenticated using(public.can_read_project(id));
create policy projects_admin on public.projects for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy activities_read on public.project_activities for select to authenticated using(public.can_read_project(project_id));
create policy activities_admin on public.project_activities for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy assignments_read on public.project_assignments for select to authenticated using((employee_id=auth.uid() and public.is_active()) or public.has_role('admin'));
create policy assignments_admin on public.project_assignments for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy sheets_read on public.timesheets for select to authenticated using(public.can_read_sheet(id));
create policy entries_read on public.time_entries for select to authenticated using(public.can_read_sheet(timesheet_id));
create policy events_read on public.timesheet_events for select to authenticated using(public.can_read_sheet(timesheet_id));

-- All timesheet writes pass through functions. No client table-write grants.
create function public.open_week(p_week date) returns uuid language plpgsql security definer set search_path = '' as $$
declare sheet uuid;
begin
  if not public.is_active() then raise exception 'Active employee account required'; end if;
  if extract(isodow from p_week) <> 1 then raise exception 'Week must start on Monday'; end if;
  insert into public.timesheets(employee_id,week_start) values(auth.uid(),p_week)
    on conflict(employee_id,week_start) do nothing;
  select id into sheet from public.timesheets where employee_id=auth.uid() and week_start=p_week;
  return sheet;
end; $$;

create function public.save_entry(p_sheet uuid,p_date date,p_project uuid,p_activity uuid,p_hours numeric,p_description text default '',p_entry uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.timesheets; entry_id uuid; today date;
begin
  select * into s from public.timesheets where id=p_sheet for update;
  if not found or s.employee_id <> auth.uid() or not public.is_active() then raise exception 'Not authorized'; end if;
  if s.status not in ('draft','returned') then raise exception 'Timesheet is locked'; end if;
  select (now() at time zone business_timezone)::date into today from public.settings;
  if p_date < s.week_start or p_date > s.week_start+6 or p_date > today then raise exception 'Invalid work date'; end if;
  if not exists(select 1 from public.project_assignments a join public.projects p on p.id=a.project_id
    join public.project_activities t on t.project_id=p.id where a.employee_id=auth.uid() and a.project_id=p_project
    and t.id=p_activity and a.active and p.active and t.active) then raise exception 'Project or activity is unavailable'; end if;
  if p_entry is null then
    insert into public.time_entries(timesheet_id,work_date,project_id,activity_id,hours,description)
    values(p_sheet,p_date,p_project,p_activity,p_hours,coalesce(p_description,'')) returning id into entry_id;
  else
    update public.time_entries set work_date=p_date,project_id=p_project,activity_id=p_activity,hours=p_hours,
      description=coalesce(p_description,'') where id=p_entry and timesheet_id=p_sheet returning id into entry_id;
    if not found then raise exception 'Entry not found'; end if;
  end if;
  return entry_id;
end; $$;

create function public.delete_entry(p_sheet uuid,p_entry uuid) returns void language plpgsql security definer set search_path = '' as $$
declare s public.timesheets;
begin
  select * into s from public.timesheets where id=p_sheet for update;
  if not found or s.employee_id <> auth.uid() or not public.is_active() then raise exception 'Not authorized'; end if;
  if s.status not in ('draft','returned') then raise exception 'Timesheet is locked'; end if;
  delete from public.time_entries where id=p_entry and timesheet_id=p_sheet;
end; $$;

create function public.submit_week(p_sheet uuid) returns void language plpgsql security definer set search_path = '' as $$
declare s public.timesheets; manager uuid;
begin
  select * into s from public.timesheets where id=p_sheet for update;
  if not found or s.employee_id <> auth.uid() or not public.is_active() then raise exception 'Not authorized'; end if;
  if s.status not in ('draft','returned') then raise exception 'Timesheet is locked'; end if;
  select p.manager_id into manager from public.profiles p join public.profiles m on m.id=p.manager_id
    where p.id=auth.uid() and m.active and exists(select 1 from public.user_roles r where r.user_id=m.id and r.role='manager');
  if manager is null or manager=auth.uid() then raise exception 'An active approving manager is required'; end if;
  if not exists(select 1 from public.time_entries where timesheet_id=p_sheet) then raise exception 'Add at least one entry'; end if;
  if exists(select 1 from public.time_entries e where e.timesheet_id=p_sheet and not exists(
    select 1 from public.project_assignments a join public.projects p on p.id=a.project_id
    join public.project_activities t on t.project_id=p.id where a.employee_id=auth.uid() and a.project_id=e.project_id
    and t.id=e.activity_id and a.active and p.active and t.active)) then raise exception 'Correct unavailable project or activity entries before submission'; end if;
  update public.timesheets set status='submitted',approver_id=manager,version=version+1,submitted_at=now(),decided_at=null where id=p_sheet;
  insert into public.timesheet_events(timesheet_id,actor_id,kind,version) values(p_sheet,auth.uid(),'submitted',s.version+1);
end; $$;

create function public.decide_week(p_sheet uuid,p_version integer,p_action text,p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.timesheets;
begin
  select * into s from public.timesheets where id=p_sheet for update;
  if not found or s.approver_id is distinct from auth.uid() or not public.has_role('manager') or s.employee_id=auth.uid() then raise exception 'Not authorized'; end if;
  if s.status <> 'submitted' or s.version <> p_version then raise exception 'This submission changed. Refresh before reviewing.'; end if;
  if p_action not in ('approved','returned') or p_action is null then raise exception 'Invalid decision'; end if;
  if p_action='returned' and (p_reason is null or length(trim(p_reason))=0) then raise exception 'A return reason is required'; end if;
  update public.timesheets set status=p_action,decided_at=now() where id=p_sheet;
  insert into public.timesheet_events(timesheet_id,actor_id,kind,version,reason)
    values(p_sheet,auth.uid(),p_action,s.version,case when p_action='returned' then trim(p_reason) else null end);
end; $$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),split_part(new.email,'@',1),'Employee'));
  insert into public.user_roles(user_id,role) values(new.id,'employee');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Backfill users created before this migration without trusting metadata for roles.
insert into public.profiles(id,display_name) select id,coalesce(email,'Employee') from auth.users on conflict do nothing;
insert into public.user_roles(user_id,role) select id,'employee' from public.profiles on conflict do nothing;

revoke all on public.profiles,public.user_roles,public.settings,public.projects,public.project_activities,public.project_assignments,public.timesheets,public.time_entries,public.timesheet_events from anon,authenticated;
grant select on public.profiles,public.user_roles,public.settings,public.projects,public.project_activities,public.project_assignments,public.timesheets,public.time_entries,public.timesheet_events to authenticated;
grant update(display_name,manager_id,active) on public.profiles to authenticated;
grant insert,update,delete on public.user_roles to authenticated;
grant insert,update on public.projects,public.project_activities,public.project_assignments to authenticated;
revoke execute on function public.is_active(),public.has_role(text),public.can_read_sheet(uuid),public.can_read_project(uuid),public.can_read_profile(uuid),public.open_week(date),public.save_entry(uuid,date,uuid,uuid,numeric,text,uuid),public.delete_entry(uuid,uuid),public.submit_week(uuid),public.decide_week(uuid,integer,text,text),public.handle_new_user() from public,anon;
grant execute on function public.is_active(),public.has_role(text),public.can_read_sheet(uuid),public.can_read_project(uuid),public.can_read_profile(uuid),public.open_week(date),public.save_entry(uuid,date,uuid,uuid,numeric,text,uuid),public.delete_entry(uuid,uuid),public.submit_week(uuid),public.decide_week(uuid,integer,text,text) to authenticated;
commit;
