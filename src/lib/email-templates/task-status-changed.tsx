import React from 'react'
import { Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from './_layout'

export interface TaskStatusChangedProps {
  creatorName?: string
  assigneeName?: string
  title?: string
  description?: string
  priorityLabel?: string
  dueDate?: string
  /** 'done' | 'in_progress' | 'todo' | 'overdue' */
  event?: 'done' | 'in_progress' | 'todo' | 'overdue'
  daysOverdue?: number
  actionUrl?: string
}

const EVENT_COPY: Record<string, { heading: string; color: string; lead: (a: string) => string; subject: (t: string) => string }> = {
  done: {
    heading: 'Úkol splněn',
    color: '#15803d',
    lead: (a) => `${a || 'Kolega'} právě označil(a) úkol jako splněný.`,
    subject: (t) => `✅ Splněno: ${t}`,
  },
  in_progress: {
    heading: 'Úkol se začal řešit',
    color: '#2563eb',
    lead: (a) => `${a || 'Kolega'} začal(a) na úkolu pracovat.`,
    subject: (t) => `▶️ V řešení: ${t}`,
  },
  todo: {
    heading: 'Úkol vrácen k řešení',
    color: '#b45309',
    lead: (a) => `${a || 'Kolega'} vrátil(a) úkol zpět do stavu „K udělání".`,
    subject: (t) => `↩️ Vráceno: ${t}`,
  },
  overdue: {
    heading: 'Úkol ještě nebyl splněn',
    color: '#b91c1c',
    lead: (a) =>
      `${a || 'Přiřazená osoba'} dosud úkol nesplnil(a) a termín už uplynul.`,
    subject: (t) => `⚠️ Nesplněný úkol po termínu: ${t}`,
  },
}

const Email = ({
  creatorName = '',
  assigneeName = '',
  title = '',
  description = '',
  priorityLabel,
  dueDate = '',
  event = 'done',
  daysOverdue,
  actionUrl = 'https://www.autoport-app.cz/ukoly',
}: TaskStatusChangedProps) => {
  const copy = EVENT_COPY[event] ?? EVENT_COPY.done
  const meta: Array<[string, string]> = []
  if (assigneeName) meta.push(['Řešitel', assigneeName])
  if (priorityLabel) meta.push(['Priorita', priorityLabel])
  if (dueDate) meta.push([event === 'overdue' ? 'Termín byl' : 'Termín', dueDate])
  if (event === 'overdue' && daysOverdue && daysOverdue > 0) {
    meta.push(['Prošvihnuto o', `${daysOverdue} ${daysOverdue === 1 ? 'den' : 'dní'}`])
  }
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`${copy.heading}: ${title || ''}`.trim()}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={{ ...styles.h1, color: copy.color }}>{copy.heading}</Heading>
            <Text style={styles.lead}>
              {creatorName ? `Dobrý den ${creatorName}, ` : 'Dobrý den, '}
              {copy.lead(assigneeName)}
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
  subject: (d: Record<string, any>) => {
    const ev = (d?.event as keyof typeof EVENT_COPY) ?? 'done'
    return (EVENT_COPY[ev] ?? EVENT_COPY.done).subject(d?.title || '')
  },
  displayName: 'Změna stavu úkolu (zadavateli)',
  previewData: {
    creatorName: 'Petr Zadavatel',
    assigneeName: 'Jan Novák',
    title: 'Doplnit dokumenty',
    description: 'TP a velký TP.',
    priorityLabel: 'Vysoká',
    dueDate: '14. 6. 2026',
    event: 'done',
    actionUrl: 'https://www.autoport-app.cz/ukoly',
  },
} satisfies TemplateEntry