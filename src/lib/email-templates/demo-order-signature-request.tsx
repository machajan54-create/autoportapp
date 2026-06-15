import React from 'react'
import { Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from './_layout'

interface Props {
  recipientName?: string
  orderNumber?: string
  modelVerze?: string
  signUrl?: string
  expiresAt?: string
}

const Email = ({ recipientName = '', orderNumber = '', modelVerze = '', signUrl = '#', expiresAt = '' }: Props) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Prosíme o podpis objednávky předváděcího vozu</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.content}>
          <Heading style={styles.h1}>Prosíme o podpis objednávky</Heading>
          <Text style={styles.lead}>{recipientName ? `Dobrý den ${recipientName},` : 'Dobrý den,'}</Text>
          <Text style={styles.lead}>
            připravili jsme pro Vás objednávku předváděcího vozu <strong>{modelVerze}</strong> (č. {orderNumber}).
            Pro dokončení prosím podepište dokument digitálně přes níže uvedený odkaz.
          </Text>
          <Hr style={styles.hr} />
          <PrimaryButton href={signUrl}>Otevřít a podepsat</PrimaryButton>
          <Text style={styles.metaRow}>Odkaz: {signUrl}</Text>
          {expiresAt ? (
            <Text style={styles.metaRow}>Platnost odkazu: {new Date(expiresAt).toLocaleDateString('cs-CZ')}</Text>
          ) : null}
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Podpis objednávky předváděcího vozu',
  displayName: 'Objednávka – žádost o podpis',
  previewData: { recipientName: 'Jan Novák', orderNumber: 'OBJ-2026-0001', modelVerze: 'C5 Aircross', signUrl: 'https://www.autoport-app.cz/sign/xxx', expiresAt: new Date().toISOString() },
} satisfies TemplateEntry