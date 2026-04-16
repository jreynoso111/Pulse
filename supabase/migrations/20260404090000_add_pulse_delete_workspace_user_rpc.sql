create or replace function public.pulse_delete_workspace_user(target_user_id uuid, target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.pulse_profiles;
begin
  select *
  into target_profile
  from public.pulse_profiles
  where id = target_user_id
    and workspace_id = target_workspace_id;

  if not found then
    raise exception 'User not found in this workspace';
  end if;

  if exists (
    select 1
    from public.pulse_boards
    where workspace_id = target_workspace_id
      and owner_user_id = target_user_id
      and delete_after is null
  ) then
    raise exception 'Delete or transfer the user-owned boards before deleting this profile.';
  end if;

  update public.pulse_boards as board
  set shared_with = (
        select coalesce(jsonb_agg(share.value), '[]'::jsonb)
        from jsonb_array_elements(coalesce(board.shared_with, '[]'::jsonb)) as share(value)
        where (share.value ->> 'userId') <> target_user_id::text
      ),
      deleted_for = (
        select coalesce(jsonb_agg(deleted_entry.value), '[]'::jsonb)
        from jsonb_array_elements(coalesce(board.deleted_for, '[]'::jsonb)) as deleted_entry(value)
        where (deleted_entry.value ->> 'userId') <> target_user_id::text
      )
  where board.workspace_id = target_workspace_id
    and (
      exists (
        select 1
        from jsonb_array_elements(coalesce(board.shared_with, '[]'::jsonb)) as share(value)
        where (share.value ->> 'userId') = target_user_id::text
      )
      or exists (
        select 1
        from jsonb_array_elements(coalesce(board.deleted_for, '[]'::jsonb)) as deleted_entry(value)
        where (deleted_entry.value ->> 'userId') = target_user_id::text
      )
    );

  delete from public.pulse_notifications
  where user_id = target_user_id;

  delete from public.pulse_board_view_preferences
  where user_id = target_user_id;

  delete from public.pulse_user_preferences
  where user_id = target_user_id;

  delete from public.pulse_profiles
  where id = target_user_id
    and workspace_id = target_workspace_id;
end;
$$;

grant execute on function public.pulse_delete_workspace_user(uuid, uuid) to service_role;
