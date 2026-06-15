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

export interface AccountWelcomeProps {
  recipientName?: string
  email?: string
  password?: string
  loginUrl?: string
  note?: string
}

const Email = ({
  recipientName = '',
  email = '',
  password = '',
  loginUrl = 'https://www.autoport-app.cz/auth',
  note = '',
}: AccountWelcomeProps) => {
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>Váš účet v Autoport App byl založen</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>Vítejte v Autoport App</Heading>
            {recipientName ? (
              <Text style={styles.lead}>Dobrý den {recipientName},</Text>
            ) : (
              <Text style={styles.lead}>Dobrý den,</Text>
            )}
            <Text style={styles.lead}>
              právě jsme pro Vás založili uživatelský účet v aplikaci Autoport App.
              Níže najdete přihlašovací údaje. Po prvním přihlášení doporučujeme
              heslo změnit ve svém profilu.
            </Text>
            <Section style={styles.metaBox}>
              {email ? (
                <Text style={styles.metaRow}><strong>Přihlašovací e-mail:</strong> {email}</Text>
              ) : null}
              {password ? (
                <Text style={styles.metaRow}><strong>Heslo:</strong> {password}</Text>
              ) : (
                <Text style={styles.metaRow}>
                  <strong>Heslo:</strong> bylo Vám sděleno samostatně administrátorem.
                </Text>
              )}
            </Section>
            {note ? (
              <Text style={{ ...styles.metaRow, whiteSpace: 'pre-wrap' as const }}>{note}</Text>
            ) : null}
            <Hr style={styles.hr} />
            <PrimaryButton href={loginUrl}>Přihlásit se</PrimaryButton>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Váš účet v Autoport App byl založen',
  displayName: 'Založení účtu – uvítací e-mail',
  previewData: {
    recipientName: 'Jan Novák',
    email: 'jan@example.com',
    password: 'Abcd1234',
    loginUrl: 'https://www.autoport-app.cz/auth',
  },
} satisfies TemplateEntry