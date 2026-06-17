import React from 'react'
import { Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from './_layout'

export interface TaskUpdatedProps {
  recipientName?: string
  actorName?: string
  title?: string
  changes?: string[]
  description?: string
  priorityLabel?: string
  dueDate?: string | null
  actionUrl?: string
}

const Email = ({
  recipientName = '',
  actorName = 'Kolega',
  title = '',
  changes = [],
  description = '',
  priorityLabel,
  dueDate,
  actionUrl = 'https://www.autoport-app.cz/ukoly',
}: TaskUpdatedProps) => {
  const meta: Array<[string, string]> = []
  if (priorityLabel) meta.push(['Priorita', priorityLabel])
  if (dueDate) meta.push(['Termín', dueDate])
  meta.push(['Upravil/a', actorName])
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`Úkol upraven: ${title || ''}`.trim()}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>Úkol byl upraven</Heading>
            <Text style={styles.lead}>
              {recipientName ? `Dobrý den ${recipientName}, ` : 'Dobrý den, '}
              {actorName} upravil(a) úkol, ke kterému máte přístup.
            </Text>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {changes.length > 0 ? (
              <Section style={styles.metaBox}>
                <Text style={styles.metaRow}><strong>Změny:</strong></Text>
                {changes.map((c, i) => (
                  <Text key={i} style={styles.metaRow}>• {c}</Text>
                ))}
              </Section>
            ) : null}
            <Section style={styles.metaBox}>
              {meta.map(([k, v]) => (
                <Text key={k} style={styles.metaRow}>
                  <strong>{k}:</strong> {v}
                </Text>
              ))}
            </Section>
            {description ? <Text style={styles.details}>{description}</Text> : null}
            <Hr style={styles.hr} />
            <PrimaryButton href={actionUrl}>Otevřít úkol</PrimaryButton>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `✏️ Úprava úkolu: ${d?.title || ''}`.trim(),
  displayName: 'Úprava úkolu',
  previewData: {
    recipientName: 'Jan Novák',
    actorName: 'Petr Admin',
    title: 'Doplnit dokumenty',
    changes: ['Termín: 14. 6. 2026 → 20. 6. 2026', 'Priorita: Střední → Vysoká'],
    priorityLabel: 'Vysoká',
    dueDate: '20. 6. 2026',
  },
} satisfies TemplateEntry