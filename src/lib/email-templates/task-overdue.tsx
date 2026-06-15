import React from 'react'
import { Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from './_layout'

export interface TaskOverdueProps {
  assigneeName?: string
  title?: string
  description?: string
  priorityLabel?: string
  dueDate?: string
  daysOverdue?: number
  actionUrl?: string
}

const Email = ({
  assigneeName = '',
  title = '',
  description = '',
  priorityLabel,
  dueDate = '',
  daysOverdue = 1,
  actionUrl = 'https://www.autoport-app.cz/ukoly',
}: TaskOverdueProps) => {
  const meta: Array<[string, string]> = []
  if (priorityLabel) meta.push(['Priorita', priorityLabel])
  if (dueDate) meta.push(['Termín byl', dueDate])
  meta.push(['Prošvihnuto o', `${daysOverdue} ${daysOverdue === 1 ? 'den' : 'dní'}`])
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`Úkol je po termínu: ${title || ''}`.trim()}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={{ ...styles.h1, color: '#b91c1c' }}>
              Úkol je po termínu
            </Heading>
            <Text style={styles.lead}>
              {assigneeName ? `Dobrý den ${assigneeName}, ` : 'Dobrý den, '}
              termín úkolu už uplynul. Prosíme o jeho dokončení nebo posunutí termínu.
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
    `⚠️ Úkol po termínu: ${d?.title || ''}`.trim(),
  displayName: 'Úkol prošvihnut (po termínu)',
  previewData: {
    assigneeName: 'Jan Novák',
    title: 'Doplnit dokumenty',
    description: 'TP a velký TP.',
    priorityLabel: 'Vysoká',
    dueDate: '14. 6. 2026',
    daysOverdue: 1,
    actionUrl: 'https://www.autoport-app.cz/ukoly',
  },
} satisfies TemplateEntry