import React from 'react'
import { Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  Body,
  Container,
  Footer,
  Header,
  Hr,
  PrimaryButton,
  styles,
} from './_layout'

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
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Section style={{ ...badge, background: approved ? '#dcfce7' : '#fee2e2', color: approved ? '#166534' : '#991b1b' }}>
              <Text style={badgeText}>{approved ? 'SCHVÁLENO' : status === 'rejected' ? 'ZAMÍTNUTO' : status.toUpperCase()}</Text>
            </Section>
            <Heading style={styles.h1}>{head}</Heading>
            {recipientName ? <Text style={styles.lead}>Dobrý den {recipientName},</Text> : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {meta.length > 0 ? (
              <Section style={styles.metaBox}>
                {meta.map((m) => (
                  <Text key={m.label} style={styles.metaRow}>
                    <strong>{m.label}:</strong> {m.value}
                  </Text>
                ))}
              </Section>
            ) : null}
            {note ? (
              <Section style={noteBox}>
                <Text style={styles.metaRow}><strong>Poznámka:</strong></Text>
                <Text style={{ ...styles.metaRow, whiteSpace: 'pre-wrap' as const }}>{note}</Text>
              </Section>
            ) : null}
            <Hr style={styles.hr} />
            <PrimaryButton href={actionUrl}>Otevřít detail</PrimaryButton>
          </Section>
          <Footer />
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

const badge = { display: 'inline-block', padding: '4px 10px', borderRadius: '999px', marginBottom: '12px' }
const badgeText = { margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }
const noteBox = { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px 16px', margin: '14px 0' }