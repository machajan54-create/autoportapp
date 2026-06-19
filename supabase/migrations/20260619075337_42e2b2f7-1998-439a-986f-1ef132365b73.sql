
-- Guard function: enforce that non-admin users cannot modify approval/decision columns

-- attendance_absences: block changes to status/resolved_by/resolved_at by non-admin
CREATE OR REPLACE FUNCTION public.guard_attendance_absences_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by
     OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN
    RAISE EXCEPTION 'Schvalování absencí může provést pouze administrátor.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_attendance_absences_approval ON public.attendance_absences;
CREATE TRIGGER trg_guard_attendance_absences_approval
  BEFORE UPDATE ON public.attendance_absences
  FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_absences_approval();

-- attendance_records: block changes to approval_status/approved_by/approved_at/approval_note by non-admin
CREATE OR REPLACE FUNCTION public.guard_attendance_records_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approval_note IS DISTINCT FROM OLD.approval_note THEN
    RAISE EXCEPTION 'Schvalování záznamů docházky může provést pouze administrátor.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_attendance_records_approval ON public.attendance_records;
CREATE TRIGGER trg_guard_attendance_records_approval
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_records_approval();

-- purchases: block changes to status/decided_by/decided_at/decision_note by non-admin
CREATE OR REPLACE FUNCTION public.guard_purchases_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.decision_note IS DISTINCT FROM OLD.decision_note THEN
    RAISE EXCEPTION 'Schvalování nákupů může provést pouze administrátor.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_purchases_approval ON public.purchases;
CREATE TRIGGER trg_guard_purchases_approval
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.guard_purchases_approval();

-- suppliers: block changes to status/decided_by/decided_at by non-admin
CREATE OR REPLACE FUNCTION public.guard_suppliers_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at THEN
    RAISE EXCEPTION 'Schvalování dodavatelů může provést pouze administrátor.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_suppliers_approval ON public.suppliers;
CREATE TRIGGER trg_guard_suppliers_approval
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.guard_suppliers_approval();
