import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TASK_STATUS = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITY = ["low", "medium", "high"] as const;
export const TASK_RECURRENCE = ["daily", "weekdays", "weekly"] as const;

export const TASK_RECURRENCE_LABEL: Record<string, string> = {
  daily: "Každý den",
  weekdays: "Každý pracovní den",
  weekly: "Každý týden",
};

/** Returns next due date (YYYY-MM-DD) given a base date and recurrence rule. */
export function computeNextDueDate(
  baseDate: string | null,
  recurrence: typeof TASK_RECURRENCE[number],
): string {
  const base = baseDate ? new Date(baseDate + "T00:00:00Z") : new Date();
  const d = new Date(base);
  if (recurrence === "daily") {
    d.setUTCDate(d.getUTCDate() + 1);
  } else if (recurrence === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7);
  } else if (recurrence === "weekdays") {
    do {
      d.setUTCDate(d.getUTCDate() + 1);
    } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  }
  return d.toISOString().slice(0, 10);
}

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
  recurrence: z.enum(TASK_RECURRENCE).optional().nullable(),
  recurrence_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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

async function notifyAssignee(opts: {
  assigneeId: string;
  assignerName: string | null;
  title: string;
  description?: string | null;
  priority?: typeof TASK_PRIORITY[number];
  dueDate?: string | null;
  taskId: string;
}) {
  try {
    const { getUserEmail, enqueueTransactionalEmail } = await import(
      "@/lib/email/notify.server"
    );
    const { email, name } = await getUserEmail(opts.assigneeId);
    if (!email) return;
    const dueFmt = opts.dueDate
      ? new Date(opts.dueDate).toLocaleDateString("cs-CZ")
      : null;
    await enqueueTransactionalEmail({
      templateName: "task-assigned",
      recipientEmail: email,
      idempotencyKey: `task-assigned-${opts.taskId}-${opts.assigneeId}`,
      templateData: {
        assigneeName: name || "",
        assignerName: opts.assignerName || "Kolega",
        title: opts.title,
        description: opts.description || "",
        priorityLabel: opts.priority
          ? TASK_PRIORITY_LABEL[opts.priority]
          : undefined,
        dueDate: dueFmt,
        actionUrl: "https://www.autoport-app.cz/ukoly",
        context: "task",
      },
    });
  } catch (e) {
    console.error("[tasks] notifyAssignee failed", e);
  }
}

async function notifyCreatorStatus(opts: {
  creatorId: string;
  assigneeName: string | null;
  title: string;
  description?: string | null;
  priority?: typeof TASK_PRIORITY[number];
  dueDate?: string | null;
  event: "done" | "in_progress" | "todo";
  taskId: string;
}) {
  try {
    const { getUserEmail, enqueueTransactionalEmail } = await import(
      "@/lib/email/notify.server"
    );
    const { email, name } = await getUserEmail(opts.creatorId);
    if (!email) return;
    const dueFmt = opts.dueDate
      ? new Date(opts.dueDate).toLocaleDateString("cs-CZ")
      : null;
    await enqueueTransactionalEmail({
      templateName: "task-status-changed",
      recipientEmail: email,
      idempotencyKey: `task-status-${opts.taskId}-${opts.event}-${Date.now()}`,
      templateData: {
        creatorName: name || "",
        assigneeName: opts.assigneeName || "",
        title: opts.title,
        description: opts.description || "",
        priorityLabel: opts.priority
          ? TASK_PRIORITY_LABEL[opts.priority]
          : undefined,
        dueDate: dueFmt,
        event: opts.event,
        actionUrl: "https://www.autoport-app.cz/ukoly",
      },
    });
  } catch (e) {
    console.error("[tasks] notifyCreatorStatus failed", e);
  }
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
        recurrence: data.recurrence || null,
        recurrence_until: data.recurrence_until || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.assignee_id && data.assignee_id !== userId) {
      await notifyAssignee({
        assigneeId: data.assignee_id,
        assignerName: creator_name,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        dueDate: data.due_date ?? null,
        taskId: row.id,
      });
    }
    return { id: row.id };
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const prev = (
      await supabase
        .from("tasks")
        .select("assignee_id,assignee_name,title,description,priority,due_date,recurrence,recurrence_until,recurrence_parent_id,status,created_by,creator_name")
        .eq("id", data.id)
        .maybeSingle()
    ).data as
      | {
          assignee_id: string | null;
          assignee_name: string | null;
          title: string;
          description: string | null;
          priority: typeof TASK_PRIORITY[number];
          due_date: string | null;
          recurrence: typeof TASK_RECURRENCE[number] | null;
          recurrence_until: string | null;
          recurrence_parent_id: string | null;
          status: typeof TASK_STATUS[number];
          created_by: string;
          creator_name: string | null;
        }
      | null;
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
    // Recurrence: when marking a recurring task done, create next occurrence
    if (
      patch.status === "done" &&
      prev &&
      prev.status !== "done" &&
      prev.recurrence
    ) {
      const nextDue = computeNextDueDate(prev.due_date, prev.recurrence);
      const untilOk = !prev.recurrence_until || nextDue <= prev.recurrence_until;
      if (untilOk) {
        await supabase.from("tasks").insert({
          title: prev.title,
          description: prev.description,
          priority: prev.priority,
          due_date: nextDue,
          assignee_id: prev.assignee_id,
          assignee_name: prev.assignee_name,
          created_by: prev.created_by,
          creator_name: prev.creator_name,
          recurrence: prev.recurrence,
          recurrence_until: prev.recurrence_until,
          recurrence_parent_id: prev.recurrence_parent_id ?? data.id,
        });
      }
    }
    const newAssignee = patch.assignee_id;
    if (
      newAssignee &&
      newAssignee !== userId &&
      newAssignee !== prev?.assignee_id
    ) {
      const assignerName = await lookupName(supabase, userId);
      await notifyAssignee({
        assigneeId: newAssignee,
        assignerName,
        title: patch.title ?? prev?.title ?? "Úkol",
        description: patch.description ?? prev?.description ?? null,
        priority: patch.priority ?? prev?.priority,
        dueDate: patch.due_date ?? prev?.due_date ?? null,
        taskId: data.id,
      });
    }
    // Notify creator about status change made by someone else (typically assignee)
    if (
      patch.status !== undefined &&
      prev &&
      patch.status !== prev.status &&
      prev.created_by &&
      prev.created_by !== userId
    ) {
      const actorName = await lookupName(supabase, userId);
      await notifyCreatorStatus({
        creatorId: prev.created_by,
        assigneeName: actorName || prev.assignee_name,
        title: patch.title ?? prev.title,
        description: patch.description ?? prev.description,
        priority: patch.priority ?? prev.priority,
        dueDate: patch.due_date ?? prev.due_date,
        event: patch.status,
        taskId: data.id,
      });
    }
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