import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface ApprovalDecisionProps {
  kind?: 'vacation' | 'purchase' | 'claim'
  status?: 'approved' | 'rejected' | string
  recipientName?: string
  title?: string
  note?: string
  meta?: Array<{ label: string; value: string }>
  actionUrl?: string
}

const KIND_LABEL: Record<string, string> = {
  vacation: 'dovolené',
  purchase: 'nákupu',
  claim: 'reklamace',
}

function headline(kind: string, status: string) {
  const k = KIND_LABEL[kind] ?? 'žádosti'
  if (status === 'approved') return `Vaše žádost ${k} byla schválena`
  if (status === 'rejected') return `Vaše žádost ${k} byla zamítnuta`
  return `Aktualizace stavu ${k}`
}

const Email = ({
  kind = 'purchase',
  status = 'approved',
  recipientName = '',
  title = '',
  note = '',
  meta = [],
  actionUrl = 'https://www.autoport-app.cz/dashboard',
}: ApprovalDecisionProps) => {
  const approved = status === 'approved'
  const head = headline(kind, status)
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{head}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={{ ...badge, background: approved ? '#dcfce7' : '#fee2e2', color: approved ? '#166534' : '#991b1b' }}>
            <Text style={badgeText}>{approved ? 'SCHVÁLENO' : status === 'rejected' ? 'ZAMÍTNUTO' : status.toUpperCase()}</Text>
          </Section>
          <Heading style={h1}>{head}</Heading>
          {recipientName ? <Text style={lead}>Dobrý den {recipientName},</Text> : null}
          {title ? <Text style={titleStyle}>{title}</Text> : null}
          {meta.length > 0 ? (
            <Section style={metaBox}>
              {meta.map((m) => (
                <Text key={m.label} style={metaRow}>
                  <strong>{m.label}:</strong> {m.value}
                </Text>
              ))}
            </Section>
          ) : null}
          {note ? (
            <Section style={noteBox}>
              <Text style={metaRow}><strong>Poznámka:</strong></Text>
              <Text style={{ ...metaRow, whiteSpace: 'pre-wrap' as const }}>{note}</Text>
            </Section>
          ) : null}
          <Hr style={hr} />
          <Text style={cta}>
            <Link href={actionUrl} style={btn}>
              Otevřít detail
            </Link>
          </Text>
          <Text style={foot}>Autoport App · automatická notifikace</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => headline(d?.kind ?? 'purchase', d?.status ?? 'approved'),
  displayName: 'Rozhodnutí o žádosti (žadatel)',
  previewData: {
    kind: 'purchase',
    status: 'approved',
    recipientName: 'Jan Novák',
    title: 'Nákup nářadí',
    note: 'Schváleno, pokračujte v objednávce.',
    meta: [{ label: 'Částka', value: '4 500 CZK' }],
    actionUrl: 'https://www.autoport-app.cz/approvals',
  },
} satisfies TemplateEntry

const body = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0 }
const container = { padding: '24px', maxWidth: '560px' }
const badge = { display: 'inline-block', padding: '4px 10px', borderRadius: '999px', marginBottom: '12px' }
const badgeText = { margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }
const h1 = { fontSize: '20px', color: '#0f172a', margin: '0 0 12px' }
const lead = { fontSize: '15px', color: '#334155', margin: '0 0 8px' }
const titleStyle = { fontSize: '17px', fontWeight: 600, color: '#0f172a', margin: '8px 0' }
const metaBox = { background: '#f8fafc', borderRadius: '8px', padding: '12px 14px', margin: '12px 0' }
const noteBox = { background: '#fffbeb', borderRadius: '8px', padding: '12px 14px', margin: '12px 0' }
const metaRow = { fontSize: '14px', color: '#0f172a', margin: '2px 0' }
const hr = { borderColor: '#e2e8f0', margin: '20px 0' }
const cta = { textAlign: 'center' as const, margin: '8px 0' }
const btn = {
  background: '#0f172a',
  color: '#ffffff',
  padding: '10px 18px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 600,
}
const foot = { fontSize: '12px', color: '#94a3b8', textAlign: 'center' as const, marginTop: '16px' }