import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enqueueTransactionalEmail } from "@/lib/email/notify.server";

const ABSENCE_TYPE_LABEL: Record<string, string> = {
  dovolena: "Dovolená",
  nemoc: "Nemoc",
  lekar: "Lékař",
  neplacene_volno: "Neplacené volno",
  jine: "Jiné",
};

// Returns the access context for the current user:
// - isAdmin: super admin role
// - canApproveAll: can see everyone's data (admin or employee.can_approve_absences)
// - myEmployeeId: paired attendance_employees row (or null)
// - isDepartmentHead / myDepartment: vedoucí oddělení (z profiles)
// - departmentEmployeeIds: ID zaměstnanců (attendance_employees), kteří patří
//   do stejného oddělení jako vedoucí — používá se pro filtrování seznamů
//   a pro kontrolu, zda smí vedoucí schválit konkrétní žádost.
async function getDochazkaAccess(supabase: any, userId: string) {
  const [{ data: roles }, { data: emp }, { data: prof }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("attendance_employees")
      .select("id,can_approve_absences")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("department,is_department_head")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  const canApproveAll = isAdmin || !!emp?.can_approve_absences;
  const isDepartmentHead = !!prof?.is_department_head && !!prof?.department;
  const myDepartment = prof?.department ?? null;

  let departmentEmployeeIds: string[] = [];
  if (!canApproveAll && isDepartmentHead && myDepartment) {
    // Najdi všechny uživatele ve stejném oddělení a k nim spárované zaměstnance
    const { data: mates } = await supabase
      .from("profiles")
      .select("id")
      .eq("department", myDepartment);
    const userIds = (mates ?? []).map((m: any) => m.id);
    if (userIds.length) {
      const { data: emps } = await supabase
        .from("attendance_employees")
        .select("id")
        .in("user_id", userIds);
      departmentEmployeeIds = (emps ?? []).map((e: any) => e.id);
    }
  }
  return {
    isAdmin,
    canApproveAll,
    myEmployeeId: emp?.id ?? null,
    isDepartmentHead,
    myDepartment,
    departmentEmployeeIds,
    canApproveTeam: isDepartmentHead && !canApproveAll,
  };
}

/** Vrátí e-mail vedoucího oddělení žadatele (na základě jeho profilu). */
async function getDeptHeadEmailForEmployee(
  supabase: any,
  employeeId: string,
): Promise<{ id: string; email: string | null; name: string | null } | null> {
  const { data: emp } = await supabase
    .from("attendance_employees")
    .select("user_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (!emp?.user_id) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("department")
    .eq("id", emp.user_id)
    .maybeSingle();
  if (!prof?.department) return null;
  const { data: head } = await supabase
    .from("profiles")
    .select("id,email,full_name")
    .eq("department", prof.department)
    .eq("is_department_head", true)
    .maybeSingle();
  if (!head) return null;
  return { id: head.id, email: head.email ?? null, name: head.full_name ?? null };
}

// ============ Employees ============

const employeeInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  role: z.string().default(""),
  pin: z.string().regex(/^\d{4,8}$/, "PIN musí být 4–8 číslic"),
  avatar_color: z.string().default("slate"),
  active: z.boolean().default(true),
  can_approve_absences: z.boolean().default(false),
  user_id: z.string().uuid().nullable().optional(),
  employment_types: z.array(z.enum(["HPP", "DPP"])).min(1).default(["HPP"]),
});

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await getDochazkaAccess(context.supabase, context.userId);
    let q = context.supabase
      .from("attendance_employees")
      .select("id,name,role,avatar_color,active,can_approve_absences,user_id,employment_types,created_at,updated_at")
      .order("name");
    if (!access.canApproveAll) {
      if (access.canApproveTeam) {
        const ids = Array.from(
          new Set([
            ...(access.myEmployeeId ? [access.myEmployeeId] : []),
            ...access.departmentEmployeeIds,
          ]),
        );
        if (!ids.length) return [];
        q = q.in("id", ids);
      } else {
        // Non-admin / non-approver sees only their own paired employee row
        if (!access.myEmployeeId) return [];
        q = q.eq("id", access.myEmployeeId);
      }
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => employeeInput.parse(d))
  .handler(async ({ data, context }) => {
    const access = await getDochazkaAccess(context.supabase, context.userId);
    if (!access.isAdmin) throw new Error("Pouze super admin");
    if (data.id) {
      const { error } = await context.supabase
        .from("attendance_employees")
        .update(data)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { id: _id, ...insert } = data;
    const { data: row, error } = await context.supabase
      .from("attendance_employees")
      .insert(insert)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Notify the new employee about their profile + how the kiosek works.
    try {
      let recipientEmail: string | null = null;
      if (data.user_id) {
        const { data: prof } = await context.supabase
          .from("profiles")
          .select("email")
          .eq("id", data.user_id)
          .maybeSingle();
        recipientEmail = prof?.email ?? null;
      }
      if (recipientEmail) {
        const origin =
          process.env.SITE_URL?.replace(/\/$/, "") ||
          "https://www.autoport-app.cz";
        await enqueueTransactionalEmail({
          templateName: "dochazka-employee-welcome",
          recipientEmail,
          idempotencyKey: `dochazka-welcome-${row.id}`,
          templateData: {
            recipientName: data.name,
            pin: data.pin,
            role: data.role,
            employmentTypes: data.employment_types,
            terminalUrl: `${origin}/terminal`,
            appUrl: `${origin}/dochazka`,
          },
        });
      }
    } catch (e) {
      console.error("[dochazka] welcome email failed", e);
    }

    return { id: row.id };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

// ============ Shifts ============

const shiftInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}/),
  end_time: z.string().regex(/^\d{2}:\d{2}/),
  color: z.string().default("blue"),
});

export const listShifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attendance_shifts")
      .select("*")
      .order("start_time");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => shiftInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("attendance_shifts").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { id: _id, ...insert } = data;
    const { data: row, error } = await context.supabase
      .from("attendance_shifts")
      .insert(insert)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

// ============ Records ============

const recordInput = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  shift_id: z.string().uuid().nullable().optional(),
  date: z.string(),
  check_in: z.string(),
  check_out: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  break_duration: z.number().int().min(0).default(0),
  hours_worked: z.number().min(0).default(0),
});

// Zaokrouhlí hodiny dolů/nahoru/nejblíže na daný krok v minutách.
function roundHours(hours: number, stepMinutes: number) {
  if (!stepMinutes || stepMinutes <= 0) return Math.round(hours * 100) / 100;
  const step = stepMinutes / 60;
  return Math.round((Math.round(hours / step) * step) * 100) / 100;
}

async function getRoundingMinutes(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("attendance_settings").select("rounding_minutes").eq("id", true).maybeSingle();
  return Number(data?.rounding_minutes ?? 0) | 0;
}

export const listRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        employee_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(5000).default(2000),
      })
      .partial()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("attendance_records")
      .select("*")
      .order("date", { ascending: false })
      .order("check_in", { ascending: false })
      .limit(data?.limit ?? 2000);
    if (data?.from) q = q.gte("date", data.from);
    if (data?.to) q = q.lte("date", data.to);
    if (data?.employee_id) q = q.eq("employee_id", data.employee_id);
    const access = await getDochazkaAccess(context.supabase, context.userId);
    if (!access.canApproveAll) {
      if (access.canApproveTeam) {
        const ids = Array.from(
          new Set([
            ...(access.myEmployeeId ? [access.myEmployeeId] : []),
            ...access.departmentEmployeeIds,
          ]),
        );
        if (!ids.length) return [];
        q = q.in("employee_id", ids);
      } else {
        if (!access.myEmployeeId) return [];
        q = q.eq("employee_id", access.myEmployeeId);
      }
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recordInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      ...data,
      shift_id: data.shift_id ?? null,
      check_out: data.check_out ?? null,
      note: data.note ?? null,
    };
    // Zaokrouhli podle nastavení (pokud je vyplněn check_out)
    if (payload.check_out && payload.check_in) {
      const stepMin = await getRoundingMinutes(context.supabase);
      if (stepMin > 0) {
        const ms = new Date(payload.check_out).getTime() - new Date(payload.check_in).getTime();
        const breakMs = (payload.break_duration ?? 0) * 60_000;
        const hours = Math.max(0, (ms - breakMs) / 3_600_000);
        payload.hours_worked = roundHours(hours, stepMin);
      }
    }
    if (data.id) {
      const { error } = await context.supabase
        .from("attendance_records")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { id: _id, ...insert } = payload;
    const { data: row, error } = await context.supabase
      .from("attendance_records")
      .insert(insert)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

// Terminal check-in: PUBLIC endpoint authenticated by PIN; uses admin client
export const terminalCheckIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      pin: z.string().regex(/^\d{4,8}$/, "PIN musí být 4–8 číslic"),
      shift_id: z.string().uuid().nullable().optional(),
      geo_lat: z.number().min(-90).max(90).nullable().optional(),
      geo_lng: z.number().min(-180).max(180).nullable().optional(),
      geo_accuracy: z.number().min(0).max(100000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp, error: empErr } = await supabaseAdmin
      .from("attendance_employees")
      .select("id,name,active")
      .eq("pin", data.pin)
      .eq("active", true)
      .maybeSingle();
    if (empErr) throw new Error(empErr.message);
    if (!emp) throw new Error("Neplatný PIN");

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);

    // Check if there's an open record today
    const { data: open } = await supabaseAdmin
      .from("attendance_records")
      .select("*")
      .eq("employee_id", emp.id)
      .eq("date", dateStr)
      .is("check_out", null)
      .maybeSingle();

    if (open) {
      // close it
      const checkIn = new Date(open.check_in).getTime();
      const now = Date.now();
      const breakMs = (open.break_duration ?? 0) * 60_000;
      const hours = Math.max(0, (now - checkIn - breakMs) / 3_600_000);
      const { data: settings } = await supabaseAdmin
        .from("attendance_settings").select("rounding_minutes").eq("id", true).maybeSingle();
      const rounded = roundHours(hours, Number(settings?.rounding_minutes ?? 0));
      const { error: updErr } = await supabaseAdmin
        .from("attendance_records")
        .update({
          check_out: new Date().toISOString(),
          hours_worked: rounded,
        })
        .eq("id", open.id);
      if (updErr) throw new Error(updErr.message);
      return { action: "checked_out" as const, employee: { id: emp.id, name: emp.name } };
    }

    const { error: insErr } = await supabaseAdmin.from("attendance_records").insert({
      employee_id: emp.id,
      shift_id: data.shift_id ?? null,
      date: dateStr,
      check_in: new Date().toISOString(),
      break_duration: 30,
      hours_worked: 0,
      geo_lat: data.geo_lat ?? null,
      geo_lng: data.geo_lng ?? null,
      geo_accuracy: data.geo_accuracy ?? null,
    });
    if (insErr) throw new Error(insErr.message);
    return { action: "checked_in" as const, employee: { id: emp.id, name: emp.name } };
  });

// Public listing of shifts for terminal display (read-only, safe columns)
export const publicListShifts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("attendance_shifts")
    .select("id,name,start_time,end_time,color")
    .order("start_time");
  if (error) throw new Error(error.message);
  return data ?? [];
});

// ============ Absences ============

const absenceInput = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  type: z.enum(["dovolena", "nemoc", "lekar", "neplacene_volno", "jine"]),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string().nullable().optional(),
  requested_resolver: z.string().uuid().nullable().optional(),
});

export const listAbsences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await getDochazkaAccess(context.supabase, context.userId);
    let q = context.supabase
      .from("attendance_absences")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (!access.canApproveAll) {
      if (!access.myEmployeeId) return [];
      q = q.eq("employee_id", access.myEmployeeId);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => absenceInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, note: data.note ?? null };
    if (data.id) {
      const { error } = await context.supabase
        .from("attendance_absences")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { id: _id, ...insert } = payload;
    const { data: row, error } = await context.supabase
      .from("attendance_absences")
      .insert(insert)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Notify super admin about new absence request
    const { data: emp } = await context.supabase
      .from("attendance_employees")
      .select("name")
      .eq("id", data.employee_id)
      .maybeSingle();
    const notify = await import("@/lib/email/notify.server");
    const mail = {
      templateName: "approval-request" as const,
      templateData: {
        kind: "vacation",
        requesterName: emp?.name ?? "Zaměstnanec",
        title: ABSENCE_TYPE_LABEL[data.type] ?? data.type,
        details: data.note ?? "",
        meta: [
          { label: "Od", value: data.start_date },
          { label: "Do", value: data.end_date },
        ],
        actionUrl: "https://www.autoport-app.cz/dochazka",
      },
    };
    if (data.requested_resolver) {
      const r = await notify.getUserEmail(data.requested_resolver);
      if (r.email) {
        await notify.enqueueTransactionalEmail({ ...mail, recipientEmail: r.email });
      } else {
        await notify.notifyAdmins(mail);
      }
    } else {
      await notify.notifyAdmins(mail);
    }
    return { id: row.id };
  });

export const resolveAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const access = await getDochazkaAccess(context.supabase, context.userId);
    if (!access.canApproveAll) throw new Error("Nemáte oprávnění schvalovat");
    const { data: resolverEmp } = await context.supabase
      .from("attendance_employees")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { error } = await context.supabase
      .from("attendance_absences")
      .update({
        status: data.status,
        resolved_at: new Date().toISOString(),
        resolved_by: resolverEmp?.id ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    {
      const { logEvent } = await import("@/lib/audit.server");
      const { data: abs } = await context.supabase
        .from("attendance_absences")
        .select("type, start_date, end_date, employee_id")
        .eq("id", data.id)
        .maybeSingle();
      await logEvent({
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        module: "dochazka",
        action: `absence_${data.status}`,
        entityId: data.id,
        entityLabel: abs ? `${abs.type} ${abs.start_date}–${abs.end_date}` : null,
        details: abs ? { employee_id: abs.employee_id } : undefined,
      });
    }
    return { ok: true };
  });

export const deleteAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

// ============ Notifications ============

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attendance_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), read: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("attendance_notifications")
      .update({ read: data.read })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("attendance_notifications")
      .update({ read: true })
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Settings ============

export const getDochazkaSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attendance_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const settingsInput = z.object({
  notify_employee_late: z.boolean().optional(),
  late_arrival_buffer_minutes: z.number().int().min(0).optional(),
  notify_employee_shift_ending: z.boolean().optional(),
  shift_ending_minutes_threshold: z.number().int().min(0).optional(),
  notify_manager_no_show: z.boolean().optional(),
  no_show_buffer_minutes: z.number().int().min(0).optional(),
  notify_manager_absence_pending: z.boolean().optional(),
  notify_employee_absence_resolved: z.boolean().optional(),
  custom_message_prefix: z.string().optional(),
  rounding_minutes: z.number().int().min(0).max(60).optional(),
  daily_overtime_threshold_hours: z.number().min(0).max(24).optional(),
  weekly_overtime_threshold_hours: z.number().min(0).max(168).optional(),
  require_record_approval: z.boolean().optional(),
});

export const updateDochazkaSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("attendance_settings")
      .update(data)
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Calendar ============

export const getMonthCalendar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const start = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const next = data.month === 12
      ? `${data.year + 1}-01-01`
      : `${data.year}-${String(data.month + 1).padStart(2, "0")}-01`;

    const access = await getDochazkaAccess(context.supabase, context.userId);
    let empQ = context.supabase
      .from("attendance_employees")
      .select("id,name,avatar_color,active,employment_types")
      .order("name");
    let recsQ = context.supabase
      .from("attendance_records")
      .select("employee_id,date,check_in,check_out,hours_worked")
      .gte("date", start)
      .lt("date", next);
    let absQ = context.supabase
      .from("attendance_absences")
      .select("employee_id,start_date,end_date,type,status")
      .lte("start_date", next)
      .gte("end_date", start);
    if (!access.canApproveAll) {
      if (!access.myEmployeeId) {
        return { employees: [], records: [], absences: [] };
      }
      empQ = empQ.eq("id", access.myEmployeeId);
      recsQ = recsQ.eq("employee_id", access.myEmployeeId);
      absQ = absQ.eq("employee_id", access.myEmployeeId);
    }
    const [emp, recs, abs] = await Promise.all([empQ, recsQ, absQ]);
    if (emp.error) throw new Error(emp.error.message);
    if (recs.error) throw new Error(recs.error.message);
    if (abs.error) throw new Error(abs.error.message);
    return {
      employees: emp.data ?? [],
      records: recs.data ?? [],
      absences: abs.data ?? [],
    };
  });

// ============ Resolver names ============

export const listResolvers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id,full_name,email");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyDochazkaAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await getDochazkaAccess(context.supabase, context.userId);
  });

// ============ DPP year overview ============
// Roční sumář hodin pro DPP zaměstnance (limit 300 h/rok dle zákoníku práce).
export const DPP_YEAR_LIMIT = 300;

export const getDppYearOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ year: z.number().int().min(2020).max(2100) }).parse(d ?? { year: new Date().getFullYear() }),
  )
  .handler(async ({ data, context }) => {
    const start = `${data.year}-01-01`;
    const next = `${data.year + 1}-01-01`;
    const access = await getDochazkaAccess(context.supabase, context.userId);
    let empQ = context.supabase
      .from("attendance_employees")
      .select("id,name,avatar_color,employment_types,active")
      .contains("employment_types", ["DPP"])
      .order("name");
    let recsQ = context.supabase
      .from("attendance_records")
      .select("employee_id,hours_worked")
      .gte("date", start)
      .lt("date", next);
    if (!access.canApproveAll) {
      if (!access.myEmployeeId) return { year: data.year, limit: DPP_YEAR_LIMIT, rows: [] };
      empQ = empQ.eq("id", access.myEmployeeId);
      recsQ = recsQ.eq("employee_id", access.myEmployeeId);
    }
    const [emp, recs] = await Promise.all([empQ, recsQ]);
    if (emp.error) throw new Error(emp.error.message);
    if (recs.error) throw new Error(recs.error.message);
    const sum = new Map<string, number>();
    for (const r of (recs.data ?? []) as any[]) {
      sum.set(r.employee_id, (sum.get(r.employee_id) ?? 0) + Number(r.hours_worked ?? 0));
    }
    const rows = (emp.data ?? []).map((e: any) => {
      const used = Math.round((sum.get(e.id) ?? 0) * 100) / 100;
      return {
        employee_id: e.id,
        name: e.name,
        avatar_color: e.avatar_color,
        active: e.active,
        used_hours: used,
        remaining_hours: Math.max(0, DPP_YEAR_LIMIT - used),
        over_limit: used > DPP_YEAR_LIMIT,
        warn_threshold: used >= DPP_YEAR_LIMIT * 0.9 && used <= DPP_YEAR_LIMIT,
      };
    });
    return { year: data.year, limit: DPP_YEAR_LIMIT, rows };
  });

// ============ Auto-fill month ============
// Vygeneruje docházku za měsíc na pracovní dny (po–pá).
// HPP: hours_per_day každý pracovní den.
// DPP: total_hours rovnoměrně rozprostřené (krok 0,25 h).
// Přeskočí dny, kde už existuje záznam nebo schválená/čekající absence.
export const autoFillMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        employee_id: z.string().uuid(),
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
        mode: z.enum(["HPP", "DPP"]),
        total_hours: z.number().min(0).max(744).optional(),
        hours_per_day: z.number().min(0.25).max(24).default(8),
        start_hour: z.number().int().min(0).max(23).default(8),
        break_minutes: z.number().int().min(0).max(240).default(30),
        shift_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const access = await getDochazkaAccess(context.supabase, context.userId);
    if (!access.canApproveAll) throw new Error("Nemáte oprávnění");

    const monthStr = `${data.year}-${String(data.month).padStart(2, "0")}`;
    const start = `${monthStr}-01`;
    const lastDay = new Date(data.year, data.month, 0).getDate();
    const next =
      data.month === 12
        ? `${data.year + 1}-01-01`
        : `${data.year}-${String(data.month + 1).padStart(2, "0")}-01`;

    // Ověření, že zaměstnanec má daný typ úvazku
    const { data: emp, error: empErr } = await context.supabase
      .from("attendance_employees")
      .select("id,name,employment_types")
      .eq("id", data.employee_id)
      .maybeSingle();
    if (empErr) throw new Error(empErr.message);
    if (!emp) throw new Error("Zaměstnanec nenalezen");
    if (!((emp as any).employment_types ?? []).includes(data.mode)) {
      throw new Error(`Zaměstnanec nemá úvazek ${data.mode}`);
    }

    // Pracovní dny v měsíci (po–pá)
    const workdays: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const dow = new Date(Date.UTC(data.year, data.month - 1, d)).getUTCDay();
      if (dow !== 0 && dow !== 6) {
        workdays.push(`${monthStr}-${String(d).padStart(2, "0")}`);
      }
    }

    // Blokované dny: existující záznamy + nezamítnuté absence
    const [existing, absences] = await Promise.all([
      context.supabase
        .from("attendance_records")
        .select("date")
        .eq("employee_id", data.employee_id)
        .gte("date", start)
        .lt("date", next),
      context.supabase
        .from("attendance_absences")
        .select("start_date,end_date,status")
        .eq("employee_id", data.employee_id)
        .neq("status", "rejected")
        .lte("start_date", next)
        .gte("end_date", start),
    ]);
    if (existing.error) throw new Error(existing.error.message);
    if (absences.error) throw new Error(absences.error.message);

    const blocked = new Set<string>();
    (existing.data ?? []).forEach((r: any) => blocked.add(r.date));
    (absences.data ?? []).forEach((a: any) => {
      const s = new Date(a.start_date);
      const e = new Date(a.end_date);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        blocked.add(d.toISOString().slice(0, 10));
      }
    });

    const days = workdays.filter((d) => !blocked.has(d));
    if (days.length === 0) throw new Error("Žádné volné pracovní dny v tomto měsíci");

    // Hodiny na den
    let perDay: number[];
    if (data.mode === "HPP") {
      perDay = days.map(() => data.hours_per_day);
    } else {
      if (!data.total_hours || data.total_hours <= 0)
        throw new Error("Pro DPP zadejte celkový počet hodin");
      const base = Math.floor((data.total_hours / days.length) * 4) / 4;
      perDay = days.map(() => base);
      let remaining = Math.round((data.total_hours - base * days.length) * 100) / 100;
      let i = 0;
      while (remaining > 0.001 && i < days.length) {
        perDay[i] = Math.round((perDay[i] + 0.25) * 100) / 100;
        remaining = Math.round((remaining - 0.25) * 100) / 100;
        i++;
      }
    }

    const rows = days.map((date, idx) => {
      const hours = perDay[idx];
      const day = Number(date.slice(8, 10));
      const checkIn = new Date(Date.UTC(data.year, data.month - 1, day, data.start_hour, 0, 0));
      const checkOut = new Date(
        checkIn.getTime() + (hours * 60 + data.break_minutes) * 60_000,
      );
      return {
        employee_id: data.employee_id,
        shift_id: data.shift_id ?? null,
        date,
        check_in: checkIn.toISOString(),
        check_out: checkOut.toISOString(),
        break_duration: data.break_minutes,
        hours_worked: hours,
        note: `Auto-vyplněno (${data.mode})`,
      };
    });

    const { error } = await context.supabase.from("attendance_records").insert(rows);
    if (error) throw new Error(error.message);
    const total = Math.round(rows.reduce((s, r) => s + r.hours_worked, 0) * 100) / 100;
    return { ok: true, created: rows.length, total_hours: total, skipped: workdays.length - days.length };
  });
// ============ Approval workflow ============

export const submitRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("attendance_records")
      .update({ approval_status: "submitted", approved_by: null, approved_at: null, approval_note: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      note: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const access = await getDochazkaAccess(context.supabase, context.userId);
    if (!access.canApproveAll) throw new Error("Nemáte oprávnění schvalovat docházku");
    const { error } = await context.supabase
      .from("attendance_records")
      .update({
        approval_status: data.status,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        approval_note: data.note ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkDecideRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(1000),
      status: z.enum(["approved", "rejected"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const access = await getDochazkaAccess(context.supabase, context.userId);
    if (!access.canApproveAll) throw new Error("Nemáte oprávnění schvalovat docházku");
    const { error } = await context.supabase
      .from("attendance_records")
      .update({
        approval_status: data.status,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });
