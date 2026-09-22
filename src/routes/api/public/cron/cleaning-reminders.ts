import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { isTaskDueOn, pragueToday } from "@/lib/cleaning.functions";

export const Route = createFileRoute("/api/public/cron/cleaning-reminders")({
  server: { handlers: { POST: handle, GET: handle } },
});

async function handle({ request }: { request: Request }) {
  const unauthorized = await requireCronAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enqueueTransactionalEmail } = await import("@/lib/email/notify.server");

    const today = pragueToday();

    const { data: tasks } = await supabaseAdmin
      .from("cleaning_tasks")
      .select("id,title,note,frequency,weekdays,assignee_id")
      .eq("active", true)
      .not("assignee_id", "is", null)
      .order("sort_order", { ascending: true });

    const { data: logs } = await supabaseAdmin
      .from("cleaning_logs")
      .select("task_id")
      .eq("log_date", today);
    const doneIds = new Set((logs ?? []).map((l) => l.task_id));

    const byUser = new Map<string, Array<{ title: string; note: string | null }>>();
    for (const t of tasks ?? []) {
      if (!t.assignee_id) continue;
      // „Dle potřeby“ (bez dnů) se denně nepřipomíná
      if (!t.weekdays || t.weekdays.length === 0) continue;
      if (!isTaskDueOn(t.weekdays, today)) continue;
      if (doneIds.has(t.id)) continue;
      const list = byUser.get(t.assignee_id) ?? [];
      list.push({ title: t.title, note: t.note ?? null });
      byUser.set(t.assignee_id, list);
    }

    let sent = 0;
    for (const [userId, items] of byUser) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email,full_name")
        .eq("id", userId)
        .maybeSingle();
      if (!prof?.email) continue;

      await enqueueTransactionalEmail({
        templateName: "cleaning-daily",
        recipientEmail: prof.email,
        idempotencyKey: `cleaning-daily-${userId}-${today}`,
        templateData: {
          assigneeName: prof.full_name || "",
          todayDate: new Date(today + "T00:00:00Z").toLocaleDateString("cs-CZ"),
          tasks: items,
          actionUrl: "https://www.autoport-app.cz/uklid",
        },
      });
      sent++;
    }

    return Response.json({ ok: true, sent, users: byUser.size, date: today });
  } catch (e: any) {
    console.error("[cron cleaning-reminders]", e?.message ?? e);
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
