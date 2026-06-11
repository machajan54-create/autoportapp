import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============ Employees ============

const employeeInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  role: z.string().default(""),
  pin: z.string().regex(/^\d{4,8}$/, "PIN musí být 4–8 číslic"),
  avatar_color: z.string().default("slate"),
  active: z.boolean().default(true),
  can_approve_absences: z.boolean().default(false),
});

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attendance_employees")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => employeeInput.parse(d))
  .handler(async ({ data, context }) => {
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
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attendance_records")
      .select("*")
      .order("date", { ascending: false })
      .order("check_in", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
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

// Terminal check-in: authenticate by PIN and create record
export const terminalCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      pin: z.string().min(4),
      shift_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: emp, error: empErr } = await context.supabase
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
    const { data: open } = await context.supabase
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
      const { error: updErr } = await context.supabase
        .from("attendance_records")
        .update({
          check_out: new Date().toISOString(),
          hours_worked: Math.round(hours * 100) / 100,
        })
        .eq("id", open.id);
      if (updErr) throw new Error(updErr.message);
      return { action: "checked_out" as const, employee: { id: emp.id, name: emp.name } };
    }

    const { error: insErr } = await context.supabase.from("attendance_records").insert({
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
    const { data, error } = await context.supabase
      .from("attendance_absences")
      .select("*")
      .order("created_at", { ascending: false });
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
    const { error } = await context.supabase
      .from("attendance_absences")
      .update({
        status: data.status,
        resolved_at: new Date().toISOString(),
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
      .limit(200);
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