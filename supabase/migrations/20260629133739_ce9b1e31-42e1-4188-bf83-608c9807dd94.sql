
CREATE OR REPLACE FUNCTION public.verify_employee_pin_v2(_pin text, _ip inet DEFAULT NULL::inet)
 RETURNS TABLE(employee_id uuid, name text, status text, retry_after_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_pepper text;
  v_lookup text;
  v_row record;
  v_ip_allowed boolean := false;
  v_ip_failures integer := 0;
  v_now timestamptz := now();
  v_window interval := interval '15 minutes';
  v_lock interval := interval '15 minutes';
  v_max integer := 5;
begin
  if _ip is not null then
    select exists(select 1 from public.attendance_pin_ip_allowlist a where _ip <<= a.ip_cidr) into v_ip_allowed;
  end if;

  if _ip is not null and not v_ip_allowed then
    select count(*) into v_ip_failures
    from public.pin_attempt_log
    where ip = _ip and success = false and attempted_at > v_now - v_window;
    if v_ip_failures >= v_max then
      insert into public.pin_attempt_log(ip, success) values (_ip, false);
      return query select null::uuid, null::text, 'ip_locked'::text, extract(epoch from v_lock)::integer;
      return;
    end if;
  end if;

  select public.get_attendance_pin_pepper() into v_pepper;
  v_lookup := encode(extensions.hmac(_pin::bytea, v_pepper::bytea, 'sha256'), 'hex');

  select p.*, e.name as emp_name, e.active as emp_active, e.id as emp_id
    into v_row
  from public.attendance_employee_pins p
  join public.attendance_employees e on e.id = p.employee_id
  where p.pin_lookup = v_lookup
  limit 1;

  if not found or v_row.emp_active = false then
    insert into public.pin_attempt_log(ip, success) values (_ip, false);
    return query select null::uuid, null::text, 'invalid'::text, null::integer;
    return;
  end if;

  if v_row.lock_until is not null and v_row.lock_until > v_now then
    insert into public.pin_attempt_log(ip, success, employee_id) values (_ip, false, v_row.emp_id);
    return query select null::uuid, null::text, 'employee_locked'::text,
                        extract(epoch from (v_row.lock_until - v_now))::integer;
    return;
  end if;

  if extensions.crypt(_pin, v_row.pin_hash) = v_row.pin_hash then
    update public.attendance_employee_pins
       set failed_attempts = 0, lock_until = null
     where employee_id = v_row.emp_id;
    insert into public.pin_attempt_log(ip, success, employee_id) values (_ip, true, v_row.emp_id);
    return query select v_row.emp_id, v_row.emp_name, 'ok'::text, null::integer;
    return;
  else
    update public.attendance_employee_pins
       set failed_attempts = failed_attempts + 1,
           lock_until = case when failed_attempts + 1 >= v_max then v_now + v_lock else lock_until end
     where employee_id = v_row.emp_id;
    insert into public.pin_attempt_log(ip, success, employee_id) values (_ip, false, v_row.emp_id);
    return query select null::uuid, null::text, 'invalid'::text, null::integer;
    return;
  end if;
end$function$;

CREATE OR REPLACE FUNCTION public.set_employee_pin(_employee_id uuid, _pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
    extensions.crypt(_pin, extensions.gen_salt('bf', 10)),
    encode(extensions.hmac(_pin::bytea, v_pepper::bytea, 'sha256'), 'hex'),
    0,
    null
  )
  on conflict (employee_id) do update
    set pin = excluded.pin,
        pin_hash = excluded.pin_hash,
        pin_lookup = excluded.pin_lookup,
        failed_attempts = 0,
        lock_until = null;
end$function$;
