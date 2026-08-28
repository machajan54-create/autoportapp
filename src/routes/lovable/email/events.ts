import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

type Reason = 'bounce' | 'complaint' | 'unsubscribe'

const STATUS: Record<Reason, 'bounced' | 'complained' | 'suppressed'> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const MESSAGE: Record<Reason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

async function record(recipient: string, reason: Reason, eventId: string) {
  const email = recipient.toLowerCase()

  const { error: suppressError } = await supabaseAdmin.from('suppressed_emails').upsert(
    { email, reason, metadata: null },
    { onConflict: 'email' },
  )
  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      event_id: eventId,
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('suppression write failed')
  }

  const { error: logError } = await supabaseAdmin.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status: STATUS[reason],
    error_message: MESSAGE[reason],
    metadata: null,
  })
  if (logError) {
    console.error('Failed to insert email_send_log', {
      event_id: eventId,
      code: logError.code,
      message: logError.message,
    })
    throw new Error('log write failed')
  }
}

export const Route = createFileRoute('/lovable/email/events')({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              await record(event.data.recipient, 'bounce', event.event_id)
            },
            'email.complaint': async (event) => {
              await record(event.data.recipient, 'complaint', event.event_id)
            },
            'email.unsubscribed': async (event) => {
              await record(event.data.recipient, 'unsubscribe', event.event_id)
            },
          },
        })
        return handler(request)
      },
    },
  },
})
