import React from 'react'
import { Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from './_layout'

export interface TaskDigestItem {
  title: string
  priorityLabel?: string
  dueDate?: string | null
  overdue?: boolean
}

export interface TaskDailyDigestProps {
  assigneeName?: string
  todayDate?: string
  overdueTasks?: TaskDigestItem[]
  todayTasks?: TaskDigestItem[]
  upcomingTasks?: TaskDigestItem[]
  actionUrl?: string
}

function row(t: TaskDigestItem) {
  const bits = [t.priorityLabel, t.dueDate ? `termín ${t.dueDate}` : null].filter(Boolean)
  return (
    <Text style={styles.metaRow} key={t.title + (t.dueDate ?? '')}>
      • <strong>{t.title}</strong>
      {bits.length ? <span style={{ color: '#64748b' }}> — {bits.join(' · ')}</span> : null}
    </Text>
  )
}

const Email = ({
  assigneeName = '',
  todayDate = '',
  overdueTasks = [],
  todayTasks = [],
  upcomingTasks = [],
  actionUrl = 'https://www.autoport-app.cz/ukoly',
}: TaskDailyDigestProps) => {
  const total = overdueTasks.length + todayTasks.length + upcomingTasks.length
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`Dnešní souhrn úkolů (${total})`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>Souhrn úkolů na dnešek</Heading>
            <Text style={styles.lead}>
              {assigneeName ? `Dobrý den ${assigneeName}, ` : 'Dobrý den, '}
              tady je přehled vašich úkolů{todayDate ? ` (${todayDate})` : ''}.
            </Text>

            {overdueTasks.length > 0 && (
              <Section style={{ ...styles.metaBox, background: '#fef2f2', borderColor: '#fecaca' }}>
                <Text style={{ ...styles.metaRow, color: '#b91c1c', fontWeight: 700 }}>
                  Po termínu ({overdueTasks.length})
                </Text>
                {overdueTasks.map(row)}
              </Section>
            )}

            {todayTasks.length > 0 && (
              <Section style={styles.metaBox}>
                <Text style={{ ...styles.metaRow, fontWeight: 700 }}>
                  Dnes ({todayTasks.length})
                </Text>
                {todayTasks.map(row)}
              </Section>
            )}

            {upcomingTasks.length > 0 && (
              <Section style={styles.metaBox}>
                <Text style={{ ...styles.metaRow, fontWeight: 700 }}>
                  Nadcházející ({upcomingTasks.length})
                </Text>
                {upcomingTasks.map(row)}
              </Section>
            )}

            {total === 0 && (
              <Text style={styles.lead}>Žádné otevřené úkoly. Krásný den!</Text>
            )}

            <Hr style={styles.hr} />
            <PrimaryButton href={actionUrl}>Otevřít úkoly</PrimaryButton>
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
    const n =
      (d?.overdueTasks?.length ?? 0) +
      (d?.todayTasks?.length ?? 0) +
      (d?.upcomingTasks?.length ?? 0)
    return `Dnešní úkoly v Autoport App (${n})`
  },
  displayName: 'Denní souhrn úkolů',
  previewData: {
    assigneeName: 'Jan Novák',
    todayDate: '15. 6. 2026',
    overdueTasks: [{ title: 'Nahrát fotky vozu', priorityLabel: 'Vysoká', dueDate: '14. 6.' }],
    todayTasks: [{ title: 'Volat zákazníkovi', priorityLabel: 'Střední', dueDate: '15. 6.' }],
    upcomingTasks: [{ title: 'Příprava výkupní smlouvy', priorityLabel: 'Nízká', dueDate: '18. 6.' }],
    actionUrl: 'https://www.autoport-app.cz/ukoly',
  },
} satisfies TemplateEntry