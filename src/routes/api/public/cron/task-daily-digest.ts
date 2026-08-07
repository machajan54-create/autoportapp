import { createFileRoute } from "@tanstack/react-router";
import { TASK_PRIORITY_LABEL } from "@/lib/tasks.functions";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/cron/task-daily-digest")({
  server: { handlers: { POST: handle, GET: handle } },
});

async function handle({ request }: { request: Request }) {
  const unauthorized = await requireCronAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enqueueTransactionalEmail } = await import("@/lib/email/notify.server");

    const todayIso = new Date().toISOString().slice(0, 10);

    const { data: open } = await supabaseAdmin
      .from("tasks")
      .select("id,title,priority,due_date,assignee_id,assignee_name")
      .neq("status", "done")
      .not("assignee_id", "is", null)
      .order("due_date", { ascending: true })
      .limit(2000);

    const byUser = new Map<string, any[]>();
    for (const t of open ?? []) {
      const list = byUser.get(t.assignee_id) ?? [];
      list.push(t);
      byUser.set(t.assignee_id, list);
    }

    let sent = 0;
    for (const [userId, tasks] of byUser) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email,full_name")
        .eq("id", userId)
        .maybeSingle();
      if (!prof?.email) continue;

      const overdueTasks: any[] = [];
      const todayTasks: any[] = [];
      const upcomingTasks: any[] = [];
      for (const t of tasks) {
        const item = {
          title: t.title,
          priorityLabel: TASK_PRIORITY_LABEL[t.priority] ?? t.priority,
          dueDate: t.due_date
            ? new Date(t.due_date + "T00:00:00Z").toLocaleDateString("cs-CZ")
            : null,
        };
        if (!t.due_date) upcomingTasks.push(item);
        else if (t.due_date < todayIso) overdueTasks.push({ ...item, overdue: true });
        else if (t.due_date === todayIso) todayTasks.push(item);
        else upcomingTasks.push(item);
      }

      if (overdueTasks.length + todayTasks.length + upcomingTasks.length === 0) continue;

      await enqueueTransactionalEmail({
        templateName: "task-daily-digest",
        recipientEmail: prof.email,
        idempotencyKey: `task-daily-digest-${userId}-${todayIso}`,
        templateData: {
          assigneeName: prof.full_name || "",
          todayDate: new Date(todayIso + "T00:00:00Z").toLocaleDateString("cs-CZ"),
          overdueTasks,
          todayTasks,
          upcomingTasks,
          actionUrl: "https://www.autoport-app.cz/ukoly",
        },
      });
      sent++;
    }
    return Response.json({ ok: true, sent, users: byUser.size });
  } catch (e: any) {
    console.error("[cron task-daily-digest]", e?.message ?? e);
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
