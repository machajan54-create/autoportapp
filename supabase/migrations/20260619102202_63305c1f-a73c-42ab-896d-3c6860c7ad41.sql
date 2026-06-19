
-- Helper: is user the department head of the given requester?
CREATE OR REPLACE FUNCTION public.is_dept_head_of(_head uuid, _requester uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles h
    JOIN public.profiles r ON r.department = h.department
    WHERE h.id = _head
      AND h.is_department_head = true
      AND r.id = _requester
      AND h.department IS NOT NULL
  );
$$;

-- Helper: can the user approve absences (admin flag or attendance_employees.can_approve_absences)
CREATE OR REPLACE FUNCTION public.can_approve_attendance(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_uid, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.attendance_employees ae
      WHERE ae.user_id = _uid AND COALESCE(ae.can_approve_absences, false) = true
    );
$$;

-- Suppliers: allow admin OR dept head of requester
CREATE OR REPLACE FUNCTION public.guard_suppliers_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR public.is_dept_head_of(auth.uid(), OLD.requested_by) THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at THEN
    RAISE EXCEPTION 'Schvalování dodavatelů může provést pouze administrátor nebo vedoucí oddělení žadatele.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Purchases: allow admin OR dept head of requester
CREATE OR REPLACE FUNCTION public.guard_purchases_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR public.is_dept_head_of(auth.uid(), OLD.requested_by) THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.decision_note IS DISTINCT FROM OLD.decision_note THEN
    RAISE EXCEPTION 'Schvalování nákupů může provést pouze administrátor nebo vedoucí oddělení žadatele.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Attendance absences: allow admin OR attendance approver OR dept head of the absence's employee user
CREATE OR REPLACE FUNCTION public.guard_attendance_absences_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_user uuid;
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR public.can_approve_attendance(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT ae.user_id INTO emp_user
  FROM public.attendance_employees ae
  WHERE ae.id = OLD.employee_id;

  IF emp_user IS NOT NULL AND public.is_dept_head_of(auth.uid(), emp_user) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by
     OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN
    RAISE EXCEPTION 'Schvalování absencí může provést pouze administrátor, schvalovatel docházky nebo vedoucí oddělení.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Attendance records: same logic
CREATE OR REPLACE FUNCTION public.guard_attendance_records_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_user uuid;
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR public.can_approve_attendance(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT ae.user_id INTO emp_user
  FROM public.attendance_employees ae
  WHERE ae.id = OLD.employee_id;

  IF emp_user IS NOT NULL AND public.is_dept_head_of(auth.uid(), emp_user) THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approval_note IS DISTINCT FROM OLD.approval_note THEN
    RAISE EXCEPTION 'Schvalování záznamů docházky může provést pouze administrátor, schvalovatel docházky nebo vedoucí oddělení.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
