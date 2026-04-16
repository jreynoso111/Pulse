alter table public.pulse_automations
  add column if not exists configuration jsonb not null default '{}'::jsonb,
  add column if not exists target_user_id uuid,
  add column if not exists created_by_user_id uuid;
