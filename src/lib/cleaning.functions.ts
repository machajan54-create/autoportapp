import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CLEANING_CATEGORY_LABEL: Record<string, string> = {
  daily: "Denní úkoly",
  weekly: "Týdenní úkoly",
  as_needed: "Dle potřeby",
  monthly: "Měsíční / čtvrtletní",
};

export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Pondělí",
  2: "Úterý",
  3: "Středa",
  4: "Čtvrtek",
  5: "Pátek",
  6: "Sobota",
  7: "Neděle",
};

/** Vrátí datum v Praze ve formátu YYYY-MM-DD. */
export function pragueToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** ISO den v týdnu (1 = pondělí … 7 = neděle) pro dané YYYY-MM-DD. */
export function isoWeekday(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Má se úkol dělat v daný den? Úkoly „dle potřeby“ jsou dostupné vždy. */
export function isTaskDueOn(weekdays: number[] | null | undefined, dateStr: string): boolean {
  if (!weekdays || weekdays.length === 0) return true;
  return weekdays.includes(isoWeekday(dateStr));
}

const dateInput = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const listCleaning = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dateInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const date = data.date ?? pragueToday();

    const [{ data: tasks, error: tErr }, { data: logs, error: lErr }] = await Promise.all([
      supabase
        .from("cleaning_tasks")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("cleaning_logs").select("*").eq("log_date", date),
    ]);
    if (tErr) throw new Error(tErr.message);
    if (lErr) throw new Error(lErr.message);

    return { date, tasks: tasks ?? [], logs: logs ?? [] };
  });

export const listCleaningHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(60).default(14) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = new Date(Date.now() - data.days * 86400000).toISOString().slice(0, 10);
    const { data: rows, error } = await supabase
      .from("cleaning_logs")
      .select("*, cleaning_tasks(title)")
      .gte("log_date", from)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

const toggleInput = z.object({
  task_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const toggleCleaningTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => toggleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!data.done) {
      const { error } = await supabase
        .from("cleaning_logs")
        .delete()
        .eq("task_id", data.task_id)
        .eq("log_date", data.date);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", userId)
      .maybeSingle();

    const { error } = await supabase.from("cleaning_logs").upsert(
      {
        task_id: data.task_id,
        log_date: data.date,
        done_by: userId,
        done_by_name: profile?.full_name || profile?.email || null,
        note: data.note || null,
      },
      { onConflict: "task_id,log_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const taskInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  frequency: z.string().trim().min(1).max(50),
  weekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
  category: z.enum(["daily", "weekly", "as_needed", "monthly"]).default("daily"),
  note: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().default(true),
  assignee_id: z.string().uuid().optional().nullable(),
  assignee_name: z.string().trim().max(200).optional().nullable(),
});

export const saveCleaningTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch = {
      title: data.title,
      frequency: data.frequency,
      weekdays: data.weekdays,
      category: data.category,
      note: data.note || null,
      active: data.active,
      assignee_id: data.assignee_id || null,
      assignee_name: data.assignee_name || null,
    };
    if (data.id) {
      const { error } = await supabase.from("cleaning_tasks").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("cleaning_tasks")
      .insert({ ...patch, sort_order: 999 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteCleaningTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cleaning_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Rychlé přiřazení úklidového úkolu konkrétnímu uživateli. */
export const setCleaningAssignee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        assignee_id: z.string().uuid().nullable(),
        assignee_name: z.string().trim().max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cleaning_tasks")
      .update({
        assignee_id: data.assignee_id,
        assignee_name: data.assignee_id ? (data.assignee_name ?? null) : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
