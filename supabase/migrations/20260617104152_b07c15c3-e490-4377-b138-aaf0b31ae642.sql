
-- 1) SCHEMA
ALTER TABLE public.vykupy
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS assignee_name text;
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS assignee_name text;
ALTER TABLE public.demo_orders
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS assignee_name text;
ALTER TABLE public.evidence_orders
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS assignee_name text;
ALTER TABLE public.logbook_vehicles
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_vykupy_created_by  ON public.vykupy(created_by);
CREATE INDEX IF NOT EXISTS idx_vykupy_assignee_id ON public.vykupy(assignee_id);
CREATE INDEX IF NOT EXISTS idx_claims_created_by  ON public.claims(created_by);
CREATE INDEX IF NOT EXISTS idx_claims_assignee_id ON public.claims(assignee_id);
CREATE INDEX IF NOT EXISTS idx_demo_orders_assignee_id ON public.demo_orders(assignee_id);
CREATE INDEX IF NOT EXISTS idx_evidence_orders_assignee_id ON public.evidence_orders(assignee_id);
CREATE INDEX IF NOT EXISTS idx_logbook_vehicles_responsible ON public.logbook_vehicles(responsible_user_id);

-- 2) TASKS
DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR assignee_id = auth.uid() );
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated
WITH CHECK ( public.is_approved_user(auth.uid()) AND created_by = auth.uid() );
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR assignee_id = auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR assignee_id = auth.uid() );
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

DROP POLICY IF EXISTS task_comments_select ON public.task_comments;
DROP POLICY IF EXISTS task_comments_insert ON public.task_comments;
DROP POLICY IF EXISTS task_comments_delete ON public.task_comments;
CREATE POLICY task_comments_select ON public.task_comments FOR SELECT TO authenticated
USING ( EXISTS ( SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id
  AND (public.has_role(auth.uid(),'admin') OR t.created_by=auth.uid() OR t.assignee_id=auth.uid()) ) );
CREATE POLICY task_comments_insert ON public.task_comments FOR INSERT TO authenticated
WITH CHECK ( author_id = auth.uid() AND EXISTS ( SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id
  AND (public.has_role(auth.uid(),'admin') OR t.created_by=auth.uid() OR t.assignee_id=auth.uid()) ) );
CREATE POLICY task_comments_delete ON public.task_comments FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

DROP POLICY IF EXISTS task_attachments_select ON public.task_attachments;
DROP POLICY IF EXISTS task_attachments_insert ON public.task_attachments;
DROP POLICY IF EXISTS task_attachments_delete ON public.task_attachments;
CREATE POLICY task_attachments_select ON public.task_attachments FOR SELECT TO authenticated
USING ( EXISTS ( SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id
  AND (public.has_role(auth.uid(),'admin') OR t.created_by=auth.uid() OR t.assignee_id=auth.uid()) ) );
CREATE POLICY task_attachments_insert ON public.task_attachments FOR INSERT TO authenticated
WITH CHECK ( uploader_id = auth.uid() AND EXISTS ( SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id
  AND (public.has_role(auth.uid(),'admin') OR t.created_by=auth.uid() OR t.assignee_id=auth.uid()) ) );
CREATE POLICY task_attachments_delete ON public.task_attachments FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

-- 3) VYKUPY
DROP POLICY IF EXISTS vykupy_select_module ON public.vykupy;
DROP POLICY IF EXISTS vykupy_insert_module ON public.vykupy;
DROP POLICY IF EXISTS vykupy_update_module ON public.vykupy;
DROP POLICY IF EXISTS vykupy_delete_module ON public.vykupy;
CREATE POLICY vykupy_select ON public.vykupy FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR assignee_id = auth.uid() );
CREATE POLICY vykupy_insert ON public.vykupy FOR INSERT TO authenticated
WITH CHECK ( public.has_module(auth.uid(),'vykupy') AND created_by = auth.uid() );
CREATE POLICY vykupy_update ON public.vykupy FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by=auth.uid() OR assignee_id=auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR created_by=auth.uid() OR assignee_id=auth.uid() );
CREATE POLICY vykupy_delete ON public.vykupy FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

DROP POLICY IF EXISTS vykup_photos_select ON public.vykup_photos;
DROP POLICY IF EXISTS vykup_photos_insert ON public.vykup_photos;
DROP POLICY IF EXISTS vykup_photos_update ON public.vykup_photos;
DROP POLICY IF EXISTS vykup_photos_delete ON public.vykup_photos;
CREATE POLICY vykup_photos_select ON public.vykup_photos FOR SELECT TO authenticated
USING ( EXISTS (SELECT 1 FROM public.vykupy v WHERE v.id = vykup_photos.vykup_id
  AND (public.has_role(auth.uid(),'admin') OR v.created_by=auth.uid() OR v.assignee_id=auth.uid())) );
CREATE POLICY vykup_photos_insert ON public.vykup_photos FOR INSERT TO authenticated
WITH CHECK ( EXISTS (SELECT 1 FROM public.vykupy v WHERE v.id = vykup_photos.vykup_id
  AND (public.has_role(auth.uid(),'admin') OR v.created_by=auth.uid() OR v.assignee_id=auth.uid())) );
CREATE POLICY vykup_photos_update ON public.vykup_photos FOR UPDATE TO authenticated
USING ( EXISTS (SELECT 1 FROM public.vykupy v WHERE v.id = vykup_photos.vykup_id
  AND (public.has_role(auth.uid(),'admin') OR v.created_by=auth.uid() OR v.assignee_id=auth.uid())) );
CREATE POLICY vykup_photos_delete ON public.vykup_photos FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

-- 4) CLAIMS
DROP POLICY IF EXISTS claims_select_module ON public.claims;
DROP POLICY IF EXISTS claims_update_module ON public.claims;
DROP POLICY IF EXISTS claims_delete_admin  ON public.claims;
CREATE POLICY claims_select ON public.claims FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR assignee_id = auth.uid() );
CREATE POLICY claims_update ON public.claims FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by=auth.uid() OR assignee_id=auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR created_by=auth.uid() OR assignee_id=auth.uid() );
CREATE POLICY claims_delete ON public.claims FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

DROP POLICY IF EXISTS attach_select_module ON public.claim_attachments;
DROP POLICY IF EXISTS attach_delete_module ON public.claim_attachments;
DROP POLICY IF EXISTS "claims module can insert attachments" ON public.claim_attachments;
CREATE POLICY claim_attachments_select ON public.claim_attachments FOR SELECT TO authenticated
USING ( EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_attachments.claim_id
  AND (public.has_role(auth.uid(),'admin') OR c.created_by=auth.uid() OR c.assignee_id=auth.uid())) );
CREATE POLICY claim_attachments_insert ON public.claim_attachments FOR INSERT TO authenticated
WITH CHECK ( EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_attachments.claim_id
  AND (public.has_role(auth.uid(),'admin') OR c.created_by=auth.uid() OR c.assignee_id=auth.uid())) );
CREATE POLICY claim_attachments_delete ON public.claim_attachments FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

DROP POLICY IF EXISTS events_select_module ON public.claim_events;
DROP POLICY IF EXISTS events_insert_module ON public.claim_events;
CREATE POLICY claim_events_select ON public.claim_events FOR SELECT TO authenticated
USING ( EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_events.claim_id
  AND (public.has_role(auth.uid(),'admin') OR c.created_by=auth.uid() OR c.assignee_id=auth.uid())) );
CREATE POLICY claim_events_insert ON public.claim_events FOR INSERT TO authenticated
WITH CHECK ( EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_events.claim_id
  AND (public.has_role(auth.uid(),'admin') OR c.created_by=auth.uid() OR c.assignee_id=auth.uid())) );

DROP POLICY IF EXISTS tasks_select_module ON public.claim_tasks;
DROP POLICY IF EXISTS tasks_insert_module ON public.claim_tasks;
DROP POLICY IF EXISTS tasks_update_module ON public.claim_tasks;
DROP POLICY IF EXISTS tasks_delete_module ON public.claim_tasks;
CREATE POLICY claim_tasks_select ON public.claim_tasks FOR SELECT TO authenticated
USING ( EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_tasks.claim_id
  AND (public.has_role(auth.uid(),'admin') OR c.created_by=auth.uid() OR c.assignee_id=auth.uid())) );
CREATE POLICY claim_tasks_insert ON public.claim_tasks FOR INSERT TO authenticated
WITH CHECK ( EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_tasks.claim_id
  AND (public.has_role(auth.uid(),'admin') OR c.created_by=auth.uid() OR c.assignee_id=auth.uid())) );
CREATE POLICY claim_tasks_update ON public.claim_tasks FOR UPDATE TO authenticated
USING ( EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_tasks.claim_id
  AND (public.has_role(auth.uid(),'admin') OR c.created_by=auth.uid() OR c.assignee_id=auth.uid())) )
WITH CHECK ( EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_tasks.claim_id
  AND (public.has_role(auth.uid(),'admin') OR c.created_by=auth.uid() OR c.assignee_id=auth.uid())) );
CREATE POLICY claim_tasks_delete ON public.claim_tasks FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

-- 5) DEFECTS
DROP POLICY IF EXISTS defects_select_module ON public.defects;
DROP POLICY IF EXISTS defects_insert_self ON public.defects;
DROP POLICY IF EXISTS defects_update_module ON public.defects;
DROP POLICY IF EXISTS defects_delete_own_or_admin ON public.defects;
CREATE POLICY defects_select ON public.defects FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR reported_by = auth.uid() OR resolved_by = auth.uid() );
CREATE POLICY defects_insert ON public.defects FOR INSERT TO authenticated
WITH CHECK ( reported_by = auth.uid() );
CREATE POLICY defects_update ON public.defects FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR reported_by=auth.uid() OR resolved_by=auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR reported_by=auth.uid() OR resolved_by=auth.uid() );
CREATE POLICY defects_delete ON public.defects FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

-- 6) DEMO ORDERS
DROP POLICY IF EXISTS "admin delete orders" ON public.demo_orders;
DROP POLICY IF EXISTS "module insert orders" ON public.demo_orders;
DROP POLICY IF EXISTS "module read orders" ON public.demo_orders;
DROP POLICY IF EXISTS "module update orders" ON public.demo_orders;
CREATE POLICY demo_orders_select ON public.demo_orders FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR assignee_id = auth.uid() );
CREATE POLICY demo_orders_insert ON public.demo_orders FOR INSERT TO authenticated
WITH CHECK ( public.has_module(auth.uid(),'demo_orders') AND created_by = auth.uid() );
CREATE POLICY demo_orders_update ON public.demo_orders FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by=auth.uid() OR assignee_id=auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR created_by=auth.uid() OR assignee_id=auth.uid() );
CREATE POLICY demo_orders_delete ON public.demo_orders FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

DROP POLICY IF EXISTS "admin delete docs" ON public.demo_order_documents;
DROP POLICY IF EXISTS "module insert docs" ON public.demo_order_documents;
DROP POLICY IF EXISTS "module read docs" ON public.demo_order_documents;
CREATE POLICY demo_order_documents_select ON public.demo_order_documents FOR SELECT TO authenticated
USING ( EXISTS (SELECT 1 FROM public.demo_orders o WHERE o.id = demo_order_documents.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) );
CREATE POLICY demo_order_documents_insert ON public.demo_order_documents FOR INSERT TO authenticated
WITH CHECK ( EXISTS (SELECT 1 FROM public.demo_orders o WHERE o.id = demo_order_documents.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) );
CREATE POLICY demo_order_documents_delete ON public.demo_order_documents FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

DROP POLICY IF EXISTS "demo_order_events insert" ON public.demo_order_events;
DROP POLICY IF EXISTS "demo_order_events read"   ON public.demo_order_events;
CREATE POLICY demo_order_events_select ON public.demo_order_events FOR SELECT TO authenticated
USING ( EXISTS (SELECT 1 FROM public.demo_orders o WHERE o.id = demo_order_events.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) );
CREATE POLICY demo_order_events_insert ON public.demo_order_events FOR INSERT TO authenticated
WITH CHECK ( EXISTS (SELECT 1 FROM public.demo_orders o WHERE o.id = demo_order_events.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) );

DROP POLICY IF EXISTS "auth write sigs"   ON public.demo_order_signatures;
DROP POLICY IF EXISTS "module read sigs"  ON public.demo_order_signatures;
DROP POLICY IF EXISTS "module update sigs" ON public.demo_order_signatures;
CREATE POLICY demo_order_signatures_select ON public.demo_order_signatures FOR SELECT TO authenticated
USING ( EXISTS (SELECT 1 FROM public.demo_orders o WHERE o.id = demo_order_signatures.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) );
CREATE POLICY demo_order_signatures_insert ON public.demo_order_signatures FOR INSERT TO authenticated
WITH CHECK ( EXISTS (SELECT 1 FROM public.demo_orders o WHERE o.id = demo_order_signatures.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) );
CREATE POLICY demo_order_signatures_update ON public.demo_order_signatures FOR UPDATE TO authenticated
USING ( EXISTS (SELECT 1 FROM public.demo_orders o WHERE o.id = demo_order_signatures.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) )
WITH CHECK ( EXISTS (SELECT 1 FROM public.demo_orders o WHERE o.id = demo_order_signatures.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) );

-- 7) EVIDENCE ORDERS
DROP POLICY IF EXISTS evidence_orders_select ON public.evidence_orders;
DROP POLICY IF EXISTS evidence_orders_insert ON public.evidence_orders;
DROP POLICY IF EXISTS evidence_orders_update ON public.evidence_orders;
DROP POLICY IF EXISTS evidence_orders_delete ON public.evidence_orders;
CREATE POLICY evidence_orders_select ON public.evidence_orders FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR assignee_id = auth.uid() );
CREATE POLICY evidence_orders_insert ON public.evidence_orders FOR INSERT TO authenticated
WITH CHECK ( public.has_module(auth.uid(),'evidence_zakazek') AND created_by = auth.uid() );
CREATE POLICY evidence_orders_update ON public.evidence_orders FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by=auth.uid() OR assignee_id=auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR created_by=auth.uid() OR assignee_id=auth.uid() );
CREATE POLICY evidence_orders_delete ON public.evidence_orders FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

DROP POLICY IF EXISTS evidence_wa_select ON public.evidence_wash_assignments;
DROP POLICY IF EXISTS evidence_wa_insert ON public.evidence_wash_assignments;
DROP POLICY IF EXISTS evidence_wa_update ON public.evidence_wash_assignments;
DROP POLICY IF EXISTS evidence_wa_delete ON public.evidence_wash_assignments;
CREATE POLICY evidence_wa_select ON public.evidence_wash_assignments FOR SELECT TO authenticated
USING ( EXISTS (SELECT 1 FROM public.evidence_orders o WHERE o.id = evidence_wash_assignments.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) );
CREATE POLICY evidence_wa_insert ON public.evidence_wash_assignments FOR INSERT TO authenticated
WITH CHECK ( EXISTS (SELECT 1 FROM public.evidence_orders o WHERE o.id = evidence_wash_assignments.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) );
CREATE POLICY evidence_wa_update ON public.evidence_wash_assignments FOR UPDATE TO authenticated
USING ( EXISTS (SELECT 1 FROM public.evidence_orders o WHERE o.id = evidence_wash_assignments.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) )
WITH CHECK ( EXISTS (SELECT 1 FROM public.evidence_orders o WHERE o.id = evidence_wash_assignments.order_id
  AND (public.has_role(auth.uid(),'admin') OR o.created_by=auth.uid() OR o.assignee_id=auth.uid())) );
CREATE POLICY evidence_wa_delete ON public.evidence_wash_assignments FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

-- 8) DEALS
DROP POLICY IF EXISTS deals_select ON public.deals;
DROP POLICY IF EXISTS deals_insert ON public.deals;
DROP POLICY IF EXISTS deals_update ON public.deals;
DROP POLICY IF EXISTS deals_delete ON public.deals;
CREATE POLICY deals_select ON public.deals FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR owner_id = auth.uid() );
CREATE POLICY deals_insert ON public.deals FOR INSERT TO authenticated
WITH CHECK ( public.has_module(auth.uid(),'deals') AND owner_id = auth.uid() );
CREATE POLICY deals_update ON public.deals FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR owner_id = auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR owner_id = auth.uid() );
CREATE POLICY deals_delete ON public.deals FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

-- 9) LOGBOOK
DROP POLICY IF EXISTS "logbook users manage entries"  ON public.logbook_entries;
DROP POLICY IF EXISTS "logbook users manage vehicles" ON public.logbook_vehicles;
CREATE POLICY logbook_entries_select ON public.logbook_entries FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() );
CREATE POLICY logbook_entries_insert ON public.logbook_entries FOR INSERT TO authenticated
WITH CHECK ( public.has_module(auth.uid(),'logbook') AND created_by = auth.uid() );
CREATE POLICY logbook_entries_update ON public.logbook_entries FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() );
CREATE POLICY logbook_entries_delete ON public.logbook_entries FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

CREATE POLICY logbook_vehicles_select ON public.logbook_vehicles FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR responsible_user_id = auth.uid() );
CREATE POLICY logbook_vehicles_insert ON public.logbook_vehicles FOR INSERT TO authenticated
WITH CHECK ( public.has_module(auth.uid(),'logbook') AND created_by = auth.uid() );
CREATE POLICY logbook_vehicles_update ON public.logbook_vehicles FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR responsible_user_id = auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR responsible_user_id = auth.uid() );
CREATE POLICY logbook_vehicles_delete ON public.logbook_vehicles FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

-- 10) PURCHASES & SUPPLIERS
DROP POLICY IF EXISTS purchases_select_own_or_admin ON public.purchases;
DROP POLICY IF EXISTS purchases_insert_self ON public.purchases;
DROP POLICY IF EXISTS purchases_update_admin ON public.purchases;
DROP POLICY IF EXISTS purchases_delete_admin ON public.purchases;
DROP POLICY IF EXISTS purchases_admin_all ON public.purchases;
CREATE POLICY purchases_select ON public.purchases FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR requested_by = auth.uid() OR decided_by = auth.uid() );
CREATE POLICY purchases_insert ON public.purchases FOR INSERT TO authenticated
WITH CHECK ( requested_by = auth.uid() );
CREATE POLICY purchases_update ON public.purchases FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR requested_by = auth.uid() OR decided_by = auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR requested_by = auth.uid() OR decided_by = auth.uid() );
CREATE POLICY purchases_delete ON public.purchases FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

DROP POLICY IF EXISTS suppliers_select_own_or_admin ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_self ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_admin ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete_admin ON public.suppliers;
DROP POLICY IF EXISTS suppliers_admin_all ON public.suppliers;
CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR requested_by = auth.uid() OR decided_by = auth.uid() );
CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT TO authenticated
WITH CHECK ( requested_by = auth.uid() );
CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR requested_by = auth.uid() OR decided_by = auth.uid() )
WITH CHECK ( public.has_role(auth.uid(),'admin') OR requested_by = auth.uid() OR decided_by = auth.uid() );
CREATE POLICY suppliers_delete ON public.suppliers FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

-- 11) DOCHÁZKA
DROP POLICY IF EXISTS "dochazka users access records" ON public.attendance_records;
DROP POLICY IF EXISTS "dochazka users access absences" ON public.attendance_absences;
CREATE POLICY attendance_records_select ON public.attendance_records FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin')
        OR EXISTS (SELECT 1 FROM public.attendance_employees e WHERE e.id = attendance_records.employee_id AND e.user_id = auth.uid()) );
CREATE POLICY attendance_records_insert ON public.attendance_records FOR INSERT TO authenticated
WITH CHECK ( public.has_role(auth.uid(),'admin')
        OR EXISTS (SELECT 1 FROM public.attendance_employees e WHERE e.id = attendance_records.employee_id AND e.user_id = auth.uid()) );
CREATE POLICY attendance_records_update ON public.attendance_records FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin')
        OR EXISTS (SELECT 1 FROM public.attendance_employees e WHERE e.id = attendance_records.employee_id AND e.user_id = auth.uid()) )
WITH CHECK ( public.has_role(auth.uid(),'admin')
        OR EXISTS (SELECT 1 FROM public.attendance_employees e WHERE e.id = attendance_records.employee_id AND e.user_id = auth.uid()) );
CREATE POLICY attendance_records_delete ON public.attendance_records FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

CREATE POLICY attendance_absences_select ON public.attendance_absences FOR SELECT TO authenticated
USING ( public.has_role(auth.uid(),'admin')
        OR EXISTS (SELECT 1 FROM public.attendance_employees e WHERE e.id = attendance_absences.employee_id AND e.user_id = auth.uid()) );
CREATE POLICY attendance_absences_insert ON public.attendance_absences FOR INSERT TO authenticated
WITH CHECK ( public.has_role(auth.uid(),'admin')
        OR EXISTS (SELECT 1 FROM public.attendance_employees e WHERE e.id = attendance_absences.employee_id AND e.user_id = auth.uid()) );
CREATE POLICY attendance_absences_update ON public.attendance_absences FOR UPDATE TO authenticated
USING ( public.has_role(auth.uid(),'admin')
        OR EXISTS (SELECT 1 FROM public.attendance_employees e WHERE e.id = attendance_absences.employee_id AND e.user_id = auth.uid()) )
WITH CHECK ( public.has_role(auth.uid(),'admin')
        OR EXISTS (SELECT 1 FROM public.attendance_employees e WHERE e.id = attendance_absences.employee_id AND e.user_id = auth.uid()) );
CREATE POLICY attendance_absences_delete ON public.attendance_absences FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') );

-- 12) Auto-fill created_by trigger
CREATE OR REPLACE FUNCTION public.set_created_by_default()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_vykupy_set_created_by ON public.vykupy;
CREATE TRIGGER trg_vykupy_set_created_by BEFORE INSERT ON public.vykupy
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by_default();
DROP TRIGGER IF EXISTS trg_demo_orders_set_created_by ON public.demo_orders;
CREATE TRIGGER trg_demo_orders_set_created_by BEFORE INSERT ON public.demo_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by_default();
DROP TRIGGER IF EXISTS trg_evidence_orders_set_created_by ON public.evidence_orders;
CREATE TRIGGER trg_evidence_orders_set_created_by BEFORE INSERT ON public.evidence_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by_default();
DROP TRIGGER IF EXISTS trg_logbook_entries_set_created_by ON public.logbook_entries;
CREATE TRIGGER trg_logbook_entries_set_created_by BEFORE INSERT ON public.logbook_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by_default();
DROP TRIGGER IF EXISTS trg_logbook_vehicles_set_created_by ON public.logbook_vehicles;
CREATE TRIGGER trg_logbook_vehicles_set_created_by BEFORE INSERT ON public.logbook_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by_default();
