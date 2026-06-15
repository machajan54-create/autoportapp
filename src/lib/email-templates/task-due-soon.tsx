import React from 'react'
import { Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from './_layout'

export interface TaskDueSoonProps {
  assigneeName?: string
  title?: string
  description?: string
  priorityLabel?: string
  dueDate?: string
  actionUrl?: string
}

const Email = ({
  assigneeName = '',
  title = '',
  description = '',
  priorityLabel,
  dueDate = '',
  actionUrl = 'https://www.autoport-app.cz/ukoly',
}: TaskDueSoonProps) => {
  const meta: Array<[string, string]> = []
  if (priorityLabel) meta.push(['Priorita', priorityLabel])
  if (dueDate) meta.push(['Termín', dueDate])
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`Připomínka: ${title || 'úkol'} – termín zítra`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>Připomínka: termín úkolu zítra</Heading>
            <Text style={styles.lead}>
              {assigneeName ? `Dobrý den ${assigneeName}, ` : 'Dobrý den, '}
              úkol má termín do 24 hodin.
            </Text>
            {title ? <Text style={styles.title}>{title}</Text> : null}
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
  subject: (d: Record<string, any>) =>
    `Připomínka: ${d?.title || 'úkol'} (termín zítra)`,
  displayName: 'Připomínka úkolu (24h před termínem)',
  previewData: {
    assigneeName: 'Jan Novák',
    title: 'Doplnit dokumenty k vozu',
    description: 'Naskenovat TP a velký TP.',
    priorityLabel: 'Vysoká',
    dueDate: '20. 6. 2026',
    actionUrl: 'https://www.autoport-app.cz/ukoly',
  },
} satisfies TemplateEntry