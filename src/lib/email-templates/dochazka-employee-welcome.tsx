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

export interface DochazkaEmployeeWelcomeProps {
  recipientName?: string
  pin?: string
  role?: string
  employmentTypes?: string[]
  terminalUrl?: string
  appUrl?: string
}

const Email = ({
  recipientName = '',
  pin = '',
  role = '',
  employmentTypes = [],
  terminalUrl = 'https://www.autoport-app.cz/terminal',
  appUrl = 'https://www.autoport-app.cz/dochazka',
}: DochazkaEmployeeWelcomeProps) => {
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>Váš profil v modulu Docházka byl vytvořen</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>Váš profil v Docházce je připraven</Heading>
            <Text style={styles.lead}>
              {recipientName ? `Dobrý den ${recipientName},` : 'Dobrý den,'}
            </Text>
            <Text style={styles.lead}>
              v aplikaci Autoport App pro Vás byl vytvořen zaměstnanecký profil
              v modulu <strong>Docházka</strong>. Níže najdete vše potřebné pro
              evidenci příchodů a odchodů.
            </Text>

            <Section style={styles.metaBox}>
              {recipientName ? (
                <Text style={styles.metaRow}><strong>Jméno:</strong> {recipientName}</Text>
              ) : null}
              {role ? (
                <Text style={styles.metaRow}><strong>Pozice:</strong> {role}</Text>
              ) : null}
              {employmentTypes.length ? (
                <Text style={styles.metaRow}>
                  <strong>Typ úvazku:</strong> {employmentTypes.join(', ')}
                </Text>
              ) : null}
              {pin ? (
                <Text style={styles.metaRow}>
                  <strong>Váš PIN k terminálu:</strong> {pin}
                </Text>
              ) : null}
            </Section>

            <Hr style={styles.hr} />

            <Heading as="h2" style={styles.h2}>Jak modul Docházka funguje</Heading>
            <Text style={styles.lead}>
              <strong>1. Píchnutí na kiosku (terminálu).</strong> Na sdíleném
              zařízení v provozovně otevřete docházkový kiosek, zadáte svůj PIN
              a zvolíte směnu. Systém automaticky zaznamená příchod nebo odchod.
            </Text>
            <Text style={styles.lead}>
              <strong>2. Absence a žádosti.</strong> Dovolenou, nemoc, lékaře
              nebo neplacené volno zadáváte v aplikaci. Schvalovatel obdrží
              notifikaci a Vy budete informováni o výsledku.
            </Text>
            <Text style={styles.lead}>
              <strong>3. Přehled a měsíční výkaz.</strong> V aplikaci uvidíte
              odpracované hodiny, kalendář směn a měsíční výkaz, který lze na
              konci měsíce odeslat ke schválení.
            </Text>

            <Hr style={styles.hr} />

            <PrimaryButton href={terminalUrl}>Otevřít docházkový kiosek</PrimaryButton>
            <Text style={{ ...styles.metaRow, marginTop: 12 }}>
              Odkaz na kiosek: {terminalUrl}
            </Text>
            <Text style={styles.metaRow}>
              Modul Docházka v aplikaci: {appUrl}
            </Text>
            <Text style={{ ...styles.metaRow, marginTop: 12 }}>
              PIN, prosím, nikomu nesdělujte. V případě jeho vyzrazení kontaktujte
              svého nadřízeného nebo administrátora.
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
  subject: 'Váš profil v Docházce byl vytvořen',
  displayName: 'Docházka – vytvoření profilu zaměstnance',
  previewData: {
    recipientName: 'Jan Novák',
    pin: '1234',
    role: 'Mechanik',
    employmentTypes: ['HPP'],
    terminalUrl: 'https://www.autoport-app.cz/terminal',
    appUrl: 'https://www.autoport-app.cz/dochazka',
  },
} satisfies TemplateEntry