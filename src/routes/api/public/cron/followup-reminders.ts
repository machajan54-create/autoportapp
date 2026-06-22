import { createFileRoute } from '@tanstack/react-router'
import { requireCronAuth } from '@/lib/cron-auth.server'

export const Route = createFileRoute('/api/public/cron/followup-reminders')({
  server: {
    handlers: {
      POST: handle,
      GET: handle,
    },
  },
})

async function handle({ request }: { request: Request }) {
  const unauthorized = await requireCronAuth(request)
  if (unauthorized) return unauthorized
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { enqueueTransactionalEmail } = await import('@/lib/email/notify.server')

    const nowIso = new Date().toISOString()
    let vykupSent = 0
    let dealSent = 0

    // Vykupy: follow_up_at <= now and not notified
    const { data: vyk } = await supabaseAdmin
      .from('vykupy')
      .select(
        'id,znacka,model,klient,poznamka,follow_up_at,internal_priced_by_user_id',
      )
      .lte('follow_up_at', nowIso)
      .is('follow_up_notified_at', null)
      .not('follow_up_at', 'is', null)
      .limit(200)

    for (const v of vyk ?? []) {
      const recipient = await getRecipient(supabaseAdmin, v.internal_priced_by_user_id)
      if (!recipient.email) {
        // mark notified anyway to prevent loop
        await supabaseAdmin
          .from('vykupy')
          .update({ follow_up_notified_at: nowIso })
          .eq('id', v.id)
        continue
      }
      await enqueueTransactionalEmail({
        templateName: 'followup-reminder',
        recipientEmail: recipient.email,
        idempotencyKey: `vykup-followup-${v.id}-${v.follow_up_at}`,
        templateData: {
          recipientName: recipient.name || '',
          entityType: 'vykup',
          title: `${v.znacka ?? ''} ${v.model ?? ''} — ${v.klient ?? ''}`.trim(),
          subtitle: v.poznamka || '',
          followUpAt: formatDateTime(v.follow_up_at),
          actionUrl: `https://www.autoport-app.cz/vykupy/${v.id}`,
        },
      })
      await supabaseAdmin
        .from('vykupy')
        .update({ follow_up_notified_at: nowIso })
        .eq('id', v.id)
      vykupSent++
    }

    // Deals: follow_up_at <= now and not notified
    const { data: deals } = await supabaseAdmin
      .from('deals')
      .select('id,title,client_name,notes,follow_up_at,owner_id')
      .lte('follow_up_at', nowIso)
      .is('follow_up_notified_at', null)
      .not('follow_up_at', 'is', null)
      .limit(200)

    for (const d of deals ?? []) {
      const recipient = await getRecipient(supabaseAdmin, d.owner_id)
      if (!recipient.email) {
        await supabaseAdmin
          .from('deals')
          .update({ follow_up_notified_at: nowIso })
          .eq('id', d.id)
        continue
      }
      await enqueueTransactionalEmail({
        templateName: 'followup-reminder',
        recipientEmail: recipient.email,
        idempotencyKey: `deal-followup-${d.id}-${d.follow_up_at}`,
        templateData: {
          recipientName: recipient.name || '',
          entityType: 'deal',
          title: d.title || d.client_name || 'Obchodní případ',
          subtitle: d.notes || '',
          followUpAt: formatDateTime(d.follow_up_at),
          actionUrl: 'https://www.autoport-app.cz/obchodni-pripady',
        },
      })
      await supabaseAdmin
        .from('deals')
        .update({ follow_up_notified_at: nowIso })
        .eq('id', d.id)
      dealSent++
    }

    return Response.json({ ok: true, vykupSent, dealSent })
  } catch (e: any) {
    console.error('[cron followup-reminders]', e?.message ?? e)
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
  }
}

async function getRecipient(admin: any, userId: string | null) {
  if (!userId) return { email: null as string | null, name: null as string | null }
  const { data } = await admin
    .from('profiles')
    .select('email,full_name')
    .eq('id', userId)
    .maybeSingle()
  return {
    email: (data?.email ?? null) as string | null,
    name: (data?.full_name ?? null) as string | null,
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })
}