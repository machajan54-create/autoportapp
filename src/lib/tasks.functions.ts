import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TASK_STATUS = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITY = ["low", "medium", "high"] as const;

export const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "K udělání",
  in_progress: "V řešení",
  done: "Hotovo",
};

export const TASK_PRIORITY_LABEL: Record<string, string> = {
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
};

const createInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  priority: z.enum(TASK_PRIORITY).default("medium"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
});

const updateInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  status: z.enum(TASK_STATUS).optional(),
  priority: z.enum(TASK_PRIORITY).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
});

async function lookupName(supabase: any, userId: string | null | undefined) {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name,email")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name || data?.email || null;
}

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const creator_name = await lookupName(supabase, userId);
    const assignee_name = data.assignee_id ? await lookupName(supabase, data.assignee_id) : null;
    const { data: row, error } = await supabase
      .from("tasks")
      .insert({
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        due_date: data.due_date || null,
        assignee_id: data.assignee_id || null,
        assignee_name,
        created_by: userId,
        creator_name,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    type Patch = {
      title?: string;
      description?: string | null;
      priority?: typeof TASK_PRIORITY[number];
      due_date?: string | null;
      assignee_id?: string | null;
      assignee_name?: string | null;
      status?: typeof TASK_STATUS[number];
      completed_at?: string | null;
    };
    const patch: Patch = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.due_date !== undefined) patch.due_date = data.due_date;
    if (data.assignee_id !== undefined) {
      patch.assignee_id = data.assignee_id;
      patch.assignee_name = data.assignee_id ? await lookupName(supabase, data.assignee_id) : null;
    }
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.completed_at = data.status === "done" ? new Date().toISOString() : null;
    }
    const { error } = await supabase.from("tasks").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });