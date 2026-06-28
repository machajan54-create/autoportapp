
-- =========================================================
-- ATTENDANCE PIN HARDENING (Phase B)
-- - bcrypt hash + HMAC lookup (pepper ve Vaultu)
-- - per-employee lockout (5/15 min)
-- - per-IP lockout (5/15 min) s konfigurovatelným allowlistem
-- - plaintext sloupec `pin` zatím PONECHÁN (drop až samostatnou migrací)
-- =========================================================

create extension if not exists pgcrypto;

-- 1) PEPPER ve Vaultu (jen pokud ještě neexistuje)
do $$
declare v_exists boolean;
begin
  select exists(select 1 from vault.secrets where name = 'attendance_pin_pepper') into v_exists;
  if not v_exists then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'attendance_pin_pepper',
      'HMAC pepper pro attendance_employee_pins.pin_lookup. Rotace = přepočet všech pin_lookup.'
    );
  end if;
end$$;

-- 2) Helper: získat pepper (SECDEF, jen pro interní použití)
create or replace function public.get_attendance_pin_pepper()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'attendance_pin_pepper' limit 1;
$$;
revoke all on function public.get_attendance_pin_pepper() from public, anon, authenticated;

-- 3) Nové sloupce na attendance_employee_pins
alter table public.attendance_employee_pins
  add column if not exists pin_hash text,
  add column if not exists pin_lookup text,
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists lock_until timestamptz;

-- 4) Backfill pin_hash + pin_lookup z plaintext `pin`
do $$
declare v_pepper text;
begin
  select public.get_attendance_pin_pepper() into v_pepper;
  update public.attendance_employee_pins
     set pin_hash = crypt(pin, gen_salt('bf', 10)),
         pin_lookup = encode(hmac(pin, v_pepper, 'sha256'), 'hex')
   where pin is not null and (pin_hash is null or pin_lookup is null);
end$$;

-- 5) UNIQUE na pin_lookup (duplicity ověřeny předem, žádné nejsou)
create unique index if not exists attendance_employee_pins_pin_lookup_uniq
  on public.attendance_employee_pins(pin_lookup)
  where pin_lookup is not null;

-- 6) Allowlist IP termínalu (konfigurovatelný)
create table if not exists public.attendance_pin_ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  ip_cidr cidr not null unique,
  label text,
  created_at timestamptz not null default now(),
  created_by uuid
);
grant select, insert, update, delete on public.attendance_pin_ip_allowlist to authenticated;
grant all on public.attendance_pin_ip_allowlist to service_role;
alter table public.attendance_pin_ip_allowlist enable row level security;
create policy "allowlist admin only"
  on public.attendance_pin_ip_allowlist for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 7) Log pokusů per-IP
create table if not exists public.pin_attempt_log (
  id bigserial primary key,
  ip inet,
  success boolean not null,
  employee_id uuid,
  attempted_at timestamptz not null default now()
);
create index if not exists pin_attempt_log_ip_time_idx
  on public.pin_attempt_log (ip, attempted_at desc);
grant select on public.pin_attempt_log to service_role;
grant insert on public.pin_attempt_log to service_role;
alter table public.pin_attempt_log enable row level security;
create policy "pin_attempt_log admin select"
  on public.pin_attempt_log for select
  using (public.has_role(auth.uid(), 'admin'));

-- 8) Nová verifikační funkce s lockoutem
create or replace function public.verify_employee_pin_v2(_pin text, _ip inet default null)
returns table(employee_id uuid, name text, status text, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
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
  -- 8a) IP allowlist check
  if _ip is not null then
    select exists(
      select 1 from public.attendance_pin_ip_allowlist a where _ip <<= a.ip_cidr
    ) into v_ip_allowed;
  end if;

  -- 8b) Per-IP lockout (jen mimo allowlist)
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

  -- 8c) Lookup
  select public.get_attendance_pin_pepper() into v_pepper;
  v_lookup := encode(hmac(_pin, v_pepper, 'sha256'), 'hex');

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

  -- 8d) Per-employee lockout
  if v_row.lock_until is not null and v_row.lock_until > v_now then
    insert into public.pin_attempt_log(ip, success, employee_id) values (_ip, false, v_row.emp_id);
    return query select null::uuid, null::text, 'employee_locked'::text,
                        extract(epoch from (v_row.lock_until - v_now))::integer;
    return;
  end if;

  -- 8e) Ověření bcrypt
  if crypt(_pin, v_row.pin_hash) = v_row.pin_hash then
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
end$$;

revoke all on function public.verify_employee_pin_v2(text, inet) from public, anon, authenticated;
grant execute on function public.verify_employee_pin_v2(text, inet) to service_role;

-- 9) Stará verify_employee_pin(text) - revoke + drop
revoke all on function public.verify_employee_pin(text) from public, anon, authenticated;
drop function if exists public.verify_employee_pin(text);

-- POZN.: sloupec attendance_employee_pins.pin (plaintext) ZÁMĚRNĚ PONECHÁN.
-- Drop proběhne samostatnou migrací po ověření, že verify_employee_pin_v2 funguje v provozu.
