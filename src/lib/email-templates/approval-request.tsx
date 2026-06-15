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
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>{label}</Heading>
            <Text style={styles.lead}>
              {requesterName} podal/a novou žádost ke schválení.
            </Text>
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
            {details ? <Text style={styles.details}>{details}</Text> : null}
            <Hr style={styles.hr} />
            <PrimaryButton href={actionUrl}>Otevřít v Autoport App</PrimaryButton>
          </Section>
          <Footer />
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