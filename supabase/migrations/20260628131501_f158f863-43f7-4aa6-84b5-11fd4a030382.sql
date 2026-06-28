
create or replace function public.set_employee_pin(_employee_id uuid, _pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_pepper text;
begin
  if _pin is null or _pin !~ '^\d{4,8}$' then
    raise exception 'PIN musí být 4–8 číslic' using errcode = '22023';
  end if;
  select public.get_attendance_pin_pepper() into v_pepper;
  insert into public.attendance_employee_pins(employee_id, pin, pin_hash, pin_lookup, failed_attempts, lock_until)
  values (
    _employee_id,
    _pin,
    crypt(_pin, gen_salt('bf', 10)),
    encode(hmac(_pin, v_pepper, 'sha256'), 'hex'),
    0,
    null
  )
  on conflict (employee_id) do update
    set pin = excluded.pin,
        pin_hash = excluded.pin_hash,
        pin_lookup = excluded.pin_lookup,
        failed_attempts = 0,
        lock_until = null;
end$$;

revoke all on function public.set_employee_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.set_employee_pin(uuid, text) to service_role;
