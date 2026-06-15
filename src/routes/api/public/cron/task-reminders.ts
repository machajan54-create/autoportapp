import { createFileRoute } from '@tanstack/react-router'
import { TASK_PRIORITY_LABEL } from '@/lib/tasks.functions'

export const Route = createFileRoute('/api/public/cron/task-reminders')({
  server: {
    handlers: {
      POST: handle,
      GET: handle,
    },
  },
})

async function handle() {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { enqueueTransactionalEmail } = await import('@/lib/email/notify.server')

    const todayIso = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const tomorrowIso = tomorrow.toISOString().slice(0, 10)

    // 1) Due in ~24h
    const { data: dueSoon } = await supabaseAdmin
      .from('tasks')
      .select('id,title,description,priority,due_date,assignee_id,assignee_name,reminder_24h_sent_at')
      .eq('due_date', tomorrowIso)
      .neq('status', 'done')
      .not('assignee_id', 'is', null)
      .is('reminder_24h_sent_at', null)
      .limit(200)

    let dueSoonSent = 0
    for (const t of dueSoon ?? []) {
      const { email, name } = await getRecipient(supabaseAdmin, t.assignee_id)
      if (!email) continue
      await enqueueTransactionalEmail({
        templateName: 'task-due-soon',
        recipientEmail: email,
        idempotencyKey: `task-due-soon-${t.id}`,
        templateData: {
          assigneeName: name || t.assignee_name || '',
          title: t.title,
          description: t.description || '',
          priorityLabel: TASK_PRIORITY_LABEL[t.priority] ?? t.priority,
          dueDate: formatDate(t.due_date),
          actionUrl: 'https://www.autoport-app.cz/ukoly',
        },
      })
      await supabaseAdmin
        .from('tasks')
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq('id', t.id)
      dueSoonSent++
    }

    // 2) Overdue
    const { data: overdue } = await supabaseAdmin
      .from('tasks')
      .select('id,title,description,priority,due_date,assignee_id,assignee_name,overdue_notified_at')
      .lt('due_date', todayIso)
      .neq('status', 'done')
      .not('assignee_id', 'is', null)
      .is('overdue_notified_at', null)
      .limit(200)

    let overdueSent = 0
    for (const t of overdue ?? []) {
      const { email, name } = await getRecipient(supabaseAdmin, t.assignee_id)
      if (!email) continue
      const days = daysBetween(t.due_date, todayIso)
      await enqueueTransactionalEmail({
        templateName: 'task-overdue',
        recipientEmail: email,
        idempotencyKey: `task-overdue-${t.id}-${todayIso}`,
        templateData: {
          assigneeName: name || t.assignee_name || '',
          title: t.title,
          description: t.description || '',
          priorityLabel: TASK_PRIORITY_LABEL[t.priority] ?? t.priority,
          dueDate: formatDate(t.due_date),
          daysOverdue: days,
          actionUrl: 'https://www.autoport-app.cz/ukoly',
        },
      })
      await supabaseAdmin
        .from('tasks')
        .update({ overdue_notified_at: new Date().toISOString() })
        .eq('id', t.id)
      overdueSent++
    }

    return Response.json({ ok: true, dueSoonSent, overdueSent })
  } catch (e: any) {
    console.error('[cron task-reminders]', e?.message ?? e)
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
  }
}

async function getRecipient(admin: any, userId: string) {
  const { data } = await admin
    .from('profiles')
    .select('email,full_name')
    .eq('id', userId)
    .maybeSingle()
  return { email: (data?.email ?? null) as string | null, name: (data?.full_name ?? null) as string | null }
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('cs-CZ')
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z').getTime()
  const b = new Date(toIso + 'T00:00:00Z').getTime()
  return Math.max(1, Math.round((b - a) / 86_400_000))
}