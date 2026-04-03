create or replace function public.pulse_delete_board(target_board_id text)
returns public.pulse_boards
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_board public.pulse_boards;
  next_deleted_for jsonb := '[]'::jsonb;
  remaining_active_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_board
  from public.pulse_boards
  where id = target_board_id
    and workspace_id = public.pulse_current_workspace_id();

  if not found then
    raise exception 'Board not found';
  end if;

  if target_board.owner_user_id <> current_user_id
     and not exists (
       select 1
       from jsonb_array_elements(coalesce(target_board.shared_with, '[]'::jsonb)) as share(value)
       where (share.value ->> 'userId') = current_user_id::text
         and coalesce((share.value ->> 'accepted')::boolean, false)
     ) then
    raise exception 'You do not have permission to delete this board';
  end if;

  next_deleted_for := coalesce(target_board.deleted_for, '[]'::jsonb);

  if not exists (
    select 1
    from jsonb_array_elements(next_deleted_for) as deleted_entry(value)
    where (deleted_entry.value ->> 'userId') = current_user_id::text
  ) then
    next_deleted_for := next_deleted_for || jsonb_build_array(
      jsonb_build_object(
        'userId', current_user_id,
        'deletedAt', timezone('utc', now())
      )
    );
  end if;

  with participants as (
    select target_board.owner_user_id as user_id
    union
    select (share.value ->> 'userId')::uuid as user_id
    from jsonb_array_elements(coalesce(target_board.shared_with, '[]'::jsonb)) as share(value)
    where coalesce((share.value ->> 'accepted')::boolean, false)
  ),
  deleted_users as (
    select (deleted_entry.value ->> 'userId')::uuid as user_id
    from jsonb_array_elements(next_deleted_for) as deleted_entry(value)
  )
  select count(*)
  into remaining_active_count
  from participants
  where user_id not in (select user_id from deleted_users);

  update public.pulse_boards
  set deleted_for = next_deleted_for,
      delete_after = case
        when remaining_active_count = 0 then timezone('utc', now()) + interval '15 days'
        else null
      end
  where id = target_board_id
  returning *
  into target_board;

  return target_board;
end;
$$;

grant execute on function public.pulse_delete_board(text) to authenticated;
