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

  if target_board.owner_user_id <> current_user_id then
    raise exception 'Only the board owner can delete this board';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', participant.user_id,
        'deletedAt', timezone('utc', now())
      )
    ),
    '[]'::jsonb
  )
  into next_deleted_for
  from (
    select target_board.owner_user_id as user_id
    union
    select (share.value ->> 'userId')::uuid as user_id
    from jsonb_array_elements(coalesce(target_board.shared_with, '[]'::jsonb)) as share(value)
    where coalesce((share.value ->> 'accepted')::boolean, false)
  ) as participant;

  update public.pulse_boards
  set deleted_for = next_deleted_for,
      delete_after = timezone('utc', now()) + interval '15 days'
  where id = target_board_id
  returning *
  into target_board;

  return target_board;
end;
$$;

grant execute on function public.pulse_delete_board(text) to authenticated;
