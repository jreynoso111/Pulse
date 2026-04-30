create table if not exists public.pulse_workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  company_name text not null,
  support_email text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pulse_profiles (
  id uuid primary key,
  workspace_id uuid not null references public.pulse_workspaces(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'member' check (role in ('admin', 'manager', 'analyst', 'member')),
  disabled boolean not null default false,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pulse_user_preferences (
  user_id uuid primary key references public.pulse_profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pulse_boards (
  id text primary key,
  workspace_id uuid not null references public.pulse_workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  preferred_view text not null default 'table',
  kanban_group_by text not null default 'status',
  kanban_card_fields text[] not null default array[]::text[],
  owner_user_id uuid references public.pulse_profiles(id) on delete set null,
  columns jsonb not null default '[]'::jsonb,
  items jsonb not null default '[]'::jsonb,
  shared_with jsonb not null default '[]'::jsonb,
  deleted_for jsonb not null default '[]'::jsonb,
  delete_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.pulse_board_view_preferences (
  user_id uuid not null references public.pulse_profiles(id) on delete cascade,
  board_id text not null references public.pulse_boards(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, board_id)
);

create table if not exists public.pulse_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pulse_profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  link text not null default '',
  type text not null default 'system',
  meta jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pulse_automations (
  id text primary key,
  workspace_id uuid not null references public.pulse_workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  trigger_type text not null,
  action_type text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pulse_profiles_workspace_idx on public.pulse_profiles(workspace_id);
create index if not exists pulse_boards_workspace_idx on public.pulse_boards(workspace_id);
create index if not exists pulse_notifications_user_idx on public.pulse_notifications(user_id, created_at desc);
create index if not exists pulse_automations_workspace_idx on public.pulse_automations(workspace_id);

create or replace function public.pulse_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pulse_workspaces_set_updated_at on public.pulse_workspaces;
create trigger pulse_workspaces_set_updated_at
before update on public.pulse_workspaces
for each row execute function public.pulse_set_updated_at();

drop trigger if exists pulse_profiles_set_updated_at on public.pulse_profiles;
create trigger pulse_profiles_set_updated_at
before update on public.pulse_profiles
for each row execute function public.pulse_set_updated_at();

drop trigger if exists pulse_user_preferences_set_updated_at on public.pulse_user_preferences;
create trigger pulse_user_preferences_set_updated_at
before update on public.pulse_user_preferences
for each row execute function public.pulse_set_updated_at();

drop trigger if exists pulse_boards_set_updated_at on public.pulse_boards;
create trigger pulse_boards_set_updated_at
before update on public.pulse_boards
for each row execute function public.pulse_set_updated_at();

drop trigger if exists pulse_board_view_preferences_set_updated_at on public.pulse_board_view_preferences;
create trigger pulse_board_view_preferences_set_updated_at
before update on public.pulse_board_view_preferences
for each row execute function public.pulse_set_updated_at();

drop trigger if exists pulse_notifications_set_updated_at on public.pulse_notifications;
create trigger pulse_notifications_set_updated_at
before update on public.pulse_notifications
for each row execute function public.pulse_set_updated_at();

drop trigger if exists pulse_automations_set_updated_at on public.pulse_automations;
create trigger pulse_automations_set_updated_at
before update on public.pulse_automations
for each row execute function public.pulse_set_updated_at();

create or replace function public.pulse_current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from public.pulse_profiles
  where id = auth.uid()
    and disabled = false
  limit 1
$$;

create or replace function public.pulse_purge_expired_boards()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.pulse_boards
  where delete_after is not null
    and delete_after <= now();
$$;

grant execute on function public.pulse_current_workspace_id() to authenticated;
grant execute on function public.pulse_purge_expired_boards() to authenticated;

alter table public.pulse_workspaces enable row level security;
alter table public.pulse_profiles enable row level security;
alter table public.pulse_user_preferences enable row level security;
alter table public.pulse_boards enable row level security;
alter table public.pulse_board_view_preferences enable row level security;
alter table public.pulse_notifications enable row level security;
alter table public.pulse_automations enable row level security;

drop policy if exists "Users can read their workspace" on public.pulse_workspaces;
create policy "Users can read their workspace"
on public.pulse_workspaces for select
to authenticated
using (id = public.pulse_current_workspace_id());

drop policy if exists "Users can read workspace profiles" on public.pulse_profiles;
create policy "Users can read workspace profiles"
on public.pulse_profiles for select
to authenticated
using (workspace_id = public.pulse_current_workspace_id());

drop policy if exists "Users can update their profile" on public.pulse_profiles;
create policy "Users can update their profile"
on public.pulse_profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users can manage their preferences" on public.pulse_user_preferences;
create policy "Users can manage their preferences"
on public.pulse_user_preferences for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can read accessible boards" on public.pulse_boards;
create policy "Users can read accessible boards"
on public.pulse_boards for select
to authenticated
using (
  workspace_id = public.pulse_current_workspace_id()
  and (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from jsonb_array_elements(shared_with) as shared(entry)
      where (entry->>'userId')::uuid = auth.uid()
        and coalesce((entry->>'accepted')::boolean, false) = true
    )
    or exists (
      select 1
      from public.pulse_profiles as profile
      where profile.id = auth.uid()
        and profile.workspace_id = pulse_boards.workspace_id
        and profile.role = 'admin'
    )
  )
);

drop policy if exists "Users can create boards in their workspace" on public.pulse_boards;
create policy "Users can create boards in their workspace"
on public.pulse_boards for insert
to authenticated
with check (
  workspace_id = public.pulse_current_workspace_id()
  and owner_user_id = auth.uid()
);

drop policy if exists "Board owners and editors can update boards" on public.pulse_boards;
create policy "Board owners and editors can update boards"
on public.pulse_boards for update
to authenticated
using (
  workspace_id = public.pulse_current_workspace_id()
  and (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from jsonb_array_elements(shared_with) as shared(entry)
      where (entry->>'userId')::uuid = auth.uid()
        and coalesce((entry->>'accepted')::boolean, false) = true
        and entry->>'permission' = 'edit'
    )
    or exists (
      select 1
      from public.pulse_profiles as profile
      where profile.id = auth.uid()
        and profile.workspace_id = pulse_boards.workspace_id
        and profile.role = 'admin'
    )
  )
)
with check (workspace_id = public.pulse_current_workspace_id());

drop policy if exists "Users can manage their board preferences" on public.pulse_board_view_preferences;
create policy "Users can manage their board preferences"
on public.pulse_board_view_preferences for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can manage their notifications" on public.pulse_notifications;
create policy "Users can manage their notifications"
on public.pulse_notifications for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can read workspace automations" on public.pulse_automations;
create policy "Users can read workspace automations"
on public.pulse_automations for select
to authenticated
using (workspace_id = public.pulse_current_workspace_id());

drop policy if exists "Admins can manage workspace automations" on public.pulse_automations;
create policy "Admins can manage workspace automations"
on public.pulse_automations for all
to authenticated
using (
  exists (
    select 1
    from public.pulse_profiles as profile
    where profile.id = auth.uid()
      and profile.workspace_id = pulse_automations.workspace_id
      and profile.role in ('admin', 'manager')
  )
)
with check (workspace_id = public.pulse_current_workspace_id());

insert into public.pulse_workspaces (id, slug, name, company_name, support_email, description)
values (
  '33966aa2-f5eb-43ff-aa7c-6f28a2108d78',
  'pulse',
  'Pulse',
  'Pulse',
  'support@pulse.office',
  'Operational workspace for boards, exports, and relational data access.'
)
on conflict (id) do update
set name = excluded.name,
    company_name = excluded.company_name,
    support_email = excluded.support_email,
    description = excluded.description;

insert into public.pulse_profiles (id, workspace_id, email, name, role, disabled, must_change_password)
select
  profile.id,
  '33966aa2-f5eb-43ff-aa7c-6f28a2108d78'::uuid,
  profile.email,
  coalesce(nullif(profile.name, ''), split_part(profile.email, '@', 1), 'Pulse User'),
  case
    when profile.role::text in ('administrator', 'admin') then 'admin'
    when profile.role::text in ('moderator', 'manager') then 'manager'
    else 'member'
  end,
  coalesce(profile.status = 'disabled', false),
  false
from public.profiles as profile
on conflict (id) do update
set email = excluded.email,
    name = excluded.name,
    role = excluded.role,
    disabled = excluded.disabled;

insert into public.pulse_user_preferences (user_id, settings)
select id, '{}'::jsonb
from public.pulse_profiles
on conflict (user_id) do nothing;
