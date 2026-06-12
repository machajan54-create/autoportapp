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

export interface ApprovalRequestProps {
  kind?: 'vacation' | 'purchase' | 'claim'
  requesterName?: string
  title?: string
  details?: string
  meta?: Array<{ label: string; value: string }>
  actionUrl?: string
}

const KIND_LABEL: Record<string, string> = {
  vacation: 'Žádost o dovolenou',
  purchase: 'Žádost o nákup',
  claim: 'Nová reklamace',
}

const Email = ({
  kind = 'purchase',
  requesterName = 'Uživatel',
  title = '',
  details = '',
  meta = [],
  actionUrl = 'https://www.autoport-app.cz/dashboard',
}: ApprovalRequestProps) => {
  const label = KIND_LABEL[kind] ?? 'Nová žádost'
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`${label}: ${title || requesterName}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>{label}</Heading>
          <Text style={lead}>
            {requesterName} podal/a novou žádost ke schválení.
          </Text>
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
          {details ? <Text style={detailsStyle}>{details}</Text> : null}
          <Hr style={hr} />
          <Text style={cta}>
            <Link href={actionUrl} style={btn}>
              Otevřít v Autoport App
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
  subject: (d: Record<string, any>) =>
    `${KIND_LABEL[d?.kind] ?? 'Nová žádost'} – ${d?.title || d?.requesterName || 'Autoport App'}`,
  displayName: 'Žádost ke schválení (super admin)',
  previewData: {
    kind: 'purchase',
    requesterName: 'Jan Novák',
    title: 'Nákup nářadí',
    details: 'Sada klíčů pro servis.',
    meta: [
      { label: 'Částka', value: '4 500 CZK' },
      { label: 'Dodavatel', value: 'ACME s.r.o.' },
    ],
    actionUrl: 'https://www.autoport-app.cz/approvals',
  },
} satisfies TemplateEntry

const body = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0 }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '20px', color: '#0f172a', margin: '0 0 12px' }
const lead = { fontSize: '15px', color: '#334155', margin: '0 0 12px' }
const titleStyle = { fontSize: '17px', fontWeight: 600, color: '#0f172a', margin: '8px 0' }
const metaBox = { background: '#f8fafc', borderRadius: '8px', padding: '12px 14px', margin: '12px 0' }
const metaRow = { fontSize: '14px', color: '#0f172a', margin: '2px 0' }
const detailsStyle = { fontSize: '14px', color: '#475569', margin: '12px 0', whiteSpace: 'pre-wrap' as const }
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