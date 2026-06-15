import React from 'react'
import { Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from './_layout'

export interface DealStageChangedProps {
  recipientName?: string
  actorName?: string
  title?: string
  vehicle?: string
  clientName?: string
  fromStageLabel?: string
  toStageLabel?: string
  durationLabel?: string
  actionUrl?: string
}

const Email = ({
  recipientName = '',
  actorName = '',
  title = '',
  vehicle = '',
  clientName = '',
  fromStageLabel = '',
  toStageLabel = '',
  durationLabel = '',
  actionUrl = 'https://www.autoport-app.cz/deals',
}: DealStageChangedProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>{`Změna fáze: ${title || 'Obchodní případ'} → ${toStageLabel}`}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.content}>
          <Heading as="h1" style={styles.h1}>Změna fáze obchodního případu</Heading>
          <Text style={styles.lead}>
            {recipientName ? `Ahoj ${recipientName}, ` : ''}
            {actorName || 'Kolega'} posunul(a) případ {fromStageLabel ? `z „${fromStageLabel}" ` : ''}
            do fáze „{toStageLabel}".
          </Text>
          <Section style={styles.metaBox}>
            <Text style={styles.metaRow}><strong>Případ:</strong> {title || '—'}</Text>
            {vehicle ? <Text style={styles.metaRow}><strong>Vůz:</strong> {vehicle}</Text> : null}
            {clientName ? <Text style={styles.metaRow}><strong>Klient:</strong> {clientName}</Text> : null}
            {durationLabel ? (
              <Text style={styles.metaRow}><strong>Doba v předchozí fázi:</strong> {durationLabel}</Text>
            ) : null}
          </Section>
          <PrimaryButton href={actionUrl}>Otevřít případ</PrimaryButton>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Fáze: ${data?.title || 'Obchodní případ'} → ${data?.toStageLabel || ''}`.trim(),
  displayName: 'Obchodní případ – změna fáze',
  previewData: {
    recipientName: 'Jana',
    actorName: 'Patrik',
    title: 'Citroën C3 — Nová s.r.o.',
    vehicle: 'Citroën C3',
    clientName: 'Nová s.r.o.',
    fromStageLabel: 'Lead',
    toStageLabel: 'Nabídka',
    durationLabel: '2 dny 4 h',
    actionUrl: 'https://www.autoport-app.cz/deals',
  },
} satisfies TemplateEntry