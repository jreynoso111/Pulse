create or replace function public.pulse_prevent_suspicious_board_item_drop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_count integer := 0;
  next_count integer := 0;
begin
  if old.items is null or new.items is null then
    return new;
  end if;

  previous_count := case
    when jsonb_typeof(old.items) = 'array' then jsonb_array_length(old.items)
    when jsonb_typeof(old.items) = 'object' then 1
    else 0
  end;

  next_count := case
    when jsonb_typeof(new.items) = 'array' then jsonb_array_length(new.items)
    when jsonb_typeof(new.items) = 'object' then 1
    else 0
  end;

  if previous_count >= 25
    and previous_count - next_count >= 20
    and next_count < previous_count * 0.5
  then
    raise exception 'Pulse blocked this update because it would remove most rows from the board at once.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists pulse_prevent_suspicious_board_item_drop_before_update on public.pulse_boards;

create trigger pulse_prevent_suspicious_board_item_drop_before_update
before update of items on public.pulse_boards
for each row
execute function public.pulse_prevent_suspicious_board_item_drop();
