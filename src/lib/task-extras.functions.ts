import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function lookupName(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name,email")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name || data?.email || null;
}

/* ---------- Comments ---------- */

export const listTaskParticipants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("task_participants")
      .select("user_id,user_name,role,created_at")
      .eq("task_id", data.taskId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const listTaskComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", data.taskId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const addTaskComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const author_name = await lookupName(supabase, userId!);
    const { data: row, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: data.taskId,
        author_id: userId!,
        author_name,
        body: data.body,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Bump task activity (used by in-app bell to detect activity by other users)
    await supabase
      .from("tasks")
      .update({ last_activity_by: userId, last_activity_at: new Date().toISOString() })
      .eq("id", data.taskId);
    // Notify the other participants (creator + assignee), excluding the author.
    try {
      const { data: task } = await supabase
        .from("tasks")
        .select("title,created_by,assignee_id")
        .eq("id", data.taskId)
        .maybeSingle();
      if (task) {
        const recipients = new Set<string>();
        if (task.created_by && task.created_by !== userId) recipients.add(task.created_by);
        if (task.assignee_id && task.assignee_id !== userId) recipients.add(task.assignee_id);
        if (recipients.size > 0) {
          const { getUserEmail, enqueueTransactionalEmail } =
            await import("@/lib/email/notify.server");
          for (const rid of recipients) {
            const { email, name } = await getUserEmail(rid);
            if (!email) continue;
            await enqueueTransactionalEmail({
              templateName: "task-comment",
              recipientEmail: email,
              idempotencyKey: `task-comment-${row.id}-${rid}`,
              templateData: {
                recipientName: name || "",
                authorName: author_name || "Kolega",
                title: task.title,
                body: data.body,
                actionUrl: "https://www.autoport-app.cz/ukoly",
              },
            });
          }
        }
      }
    } catch (e) {
      console.error("[tasks] notify on comment failed", e);
    }
    return { id: row.id };
  });

/** Souhrn aktivity (komentáře + přílohy) pro náhled v seznamu úkolů. */
export const listTaskActivitySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: comments, error: cErr }, { data: attachments, error: aErr }] = await Promise.all([
      supabase
        .from("task_comments")
        .select("task_id,author_id,author_name,body,created_at")
        .order("created_at", { ascending: true }),
      supabase.from("task_attachments").select("task_id,file_name,created_at"),
    ]);
    if (cErr) throw new Error(cErr.message);
    if (aErr) throw new Error(aErr.message);
    const map: Record<
      string,
      {
        comments: number;
        attachments: number;
        last_comment?: {
          author_id: string | null;
          author_name: string | null;
          body: string;
          created_at: string;
        };
      }
    > = {};
    for (const c of comments ?? []) {
      const e = (map[c.task_id] ??= { comments: 0, attachments: 0 });
      e.comments += 1;
      e.last_comment = {
        author_id: c.author_id ?? null,
        author_name: c.author_name ?? null,
        body: c.body,
        created_at: c.created_at,
      };
    }
    for (const a of attachments ?? []) {
      const e = (map[a.task_id] ??= { comments: 0, attachments: 0 });
      e.attachments += 1;
    }
    return { summary: map };
  });

export const deleteTaskComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

/* ---------- Attachments ---------- */

export const listTaskAttachments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", data.taskId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const recordTaskAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        file_name: z.string().min(1).max(255),
        storage_path: z.string().min(1).max(500),
        size_bytes: z
          .number()
          .int()
          .nonnegative()
          .max(50 * 1024 * 1024),
        content_type: z.string().max(127).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const uploader_name = await lookupName(supabase, userId!);
    const { data: row, error } = await supabase
      .from("task_attachments")
      .insert({
        task_id: data.taskId,
        uploader_id: userId!,
        uploader_name,
        file_name: data.file_name,
        storage_path: data.storage_path,
        size_bytes: data.size_bytes,
        content_type: data.content_type ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteTaskAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

export const getTaskAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("task_attachments")
      .select("storage_path,file_name")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Příloha nenalezena");
    const { data: signed, error: sErr } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(row.storage_path, 300, { download: row.file_name });
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl, file_name: row.file_name };
  });
