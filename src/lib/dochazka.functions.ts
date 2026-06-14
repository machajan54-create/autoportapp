import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
async function getDochazkaAccess(supabase: any, userId: string) {
  const [{ data: roles }, { data: emp }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("attendance_employees")
      .select("id,can_approve_absences")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  const canApproveAll = isAdmin || !!emp?.can_approve_absences;
  return { isAdmin, canApproveAll, myEmployeeId: emp?.id ?? null };
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
      // Non-admin / non-approver sees only their own paired employee row
      if (!access.myEmployeeId) return [];
      q = q.eq("id", access.myEmployeeId);
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
    return { id: row.id };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("attendance_employees")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("attendance_shifts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
      if (!access.myEmployeeId) return [];
      q = q.eq("employee_id", access.myEmployeeId);
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
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("attendance_records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Terminal check-in: PUBLIC endpoint authenticated by PIN; uses admin client
export const terminalCheckIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      pin: z.string().regex(/^\d{4,8}$/, "PIN musí být 4–8 číslic"),
      shift_id: z.string().uuid().nullable().optional(),
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
      const { error: updErr } = await supabaseAdmin
        .from("attendance_records")
        .update({
          check_out: new Date().toISOString(),
          hours_worked: Math.round(hours * 100) / 100,
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
    await (await import("@/lib/email/notify.server")).notifyAdmins({
      templateName: "approval-request",
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
    });
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
    const { error } = await context.supabase
      .from("attendance_absences")
      .update({
        status: data.status,
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("attendance_absences").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
      .eq("employment_types", "DPP")
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