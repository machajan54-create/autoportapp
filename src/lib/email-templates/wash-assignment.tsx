import React from 'react'
import { Head, Heading, Html, Preview, Section, Text, Link } from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  Body,
  Container,
  Footer,
  Header,
  Hr,
  styles,
} from './_layout'

export interface WashAssignmentProps {
  recipientName?: string
  klient?: string
  vozidlo?: string
  vis?: string
  den?: string
  hodina?: string
  cisloZakazky?: string
  poznamka?: string
  acceptUrl?: string
  declineUrl?: string
}

const Email = ({
  recipientName = '',
  klient = '',
  vozidlo = '',
  vis = '',
  den = '',
  hodina = '',
  cisloZakazky = '',
  poznamka = '',
  acceptUrl = '#',
  declineUrl = '#',
}: WashAssignmentProps) => {
  const meta = [
    klient && { label: 'Klient', value: klient },
    vozidlo && { label: 'Vozidlo', value: vozidlo },
    vis && { label: 'VIS / SPZ', value: vis },
    den && { label: 'Den', value: den },
    hodina && { label: 'Hodina', value: hodina },
    cisloZakazky && { label: 'Č. zakázky', value: cisloZakazky },
  ].filter(Boolean) as Array<{ label: string; value: string }>
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`Žádost o mytí vozu ${vozidlo || ''} ${den || ''}`.trim()}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>Nová zakázka k mytí</Heading>
            {recipientName ? (
              <Text style={styles.lead}>Dobrý den {recipientName},</Text>
            ) : null}
            <Text style={styles.lead}>
              Byl/a jste přiřazen/a k mytí následujícího vozu. Prosíme o potvrzení převzetí.
            </Text>
            {meta.length > 0 ? (
              <Section style={styles.metaBox}>
                {meta.map((m) => (
                  <Text key={m.label} style={styles.metaRow}>
                    <strong>{m.label}:</strong> {m.value}
                  </Text>
                ))}
              </Section>
            ) : null}
            {poznamka ? <Text style={styles.details}>Poznámka: {poznamka}</Text> : null}
            <Hr style={styles.hr} />
            <Section style={{ textAlign: 'center' as const, margin: '8px 0 20px' }}>
              <Link href={acceptUrl} style={{ ...styles.btn, background: '#16a34a', marginRight: 8 }}>
                Přijímám
              </Link>
              <Link href={declineUrl} style={{ ...styles.btn, background: '#dc2626' }}>
                Odmítám
              </Link>
            </Section>
            <Text style={{ ...styles.footerText, textAlign: 'center' as const }}>
              Tlačítka jsou jednorázová — po kliknutí se zaeviduje vaše rozhodnutí.
            </Text>
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
    `Mytí vozu${d?.vozidlo ? ` – ${d.vozidlo}` : ''}${d?.den ? ` (${d.den})` : ''}`,
  displayName: 'Přiřazení mytí (myč)',
  previewData: {
    recipientName: 'Karpich',
    klient: 'ČSOB Veolia',
    vozidlo: 'Jumper',
    vis: 'TG033272',
    den: '15.6.2026',
    hodina: '9:00',
    cisloZakazky: 'CT6306',
    poznamka: '',
    acceptUrl: 'https://www.autoport-app.cz/wash-respond/accept/demo',
    declineUrl: 'https://www.autoport-app.cz/wash-respond/decline/demo',
  },
} satisfies TemplateEntry