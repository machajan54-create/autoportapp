import React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface WeeklyReportProps {
  periodLabel?: string
  claimsActive?: number
  claimsNew?: number
  vykupyActive?: number
  vykupySold?: number
  obratKc?: number
  marzeKc?: number
  defectsOpen?: number
  defectsCritical?: number
  dochazkaHours?: number
  dppWarnings?: Array<{ name: string; hours: number }>
  absencesPending?: number
}

const fmt = (n?: number) => new Intl.NumberFormat('cs-CZ').format(n ?? 0)
const kc = (n?: number) => `${fmt(n)} Kč`

const Email = ({
  periodLabel = 'Tento týden',
  claimsActive = 0,
  claimsNew = 0,
  vykupyActive = 0,
  vykupySold = 0,
  obratKc = 0,
  marzeKc = 0,
  defectsOpen = 0,
  defectsCritical = 0,
  dochazkaHours = 0,
  dppWarnings = [],
  absencesPending = 0,
}: WeeklyReportProps) => (
  <Html lang="cs">
    <Head />
    <Preview>Týdenní přehled Autoport APP — {periodLabel}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Týdenní přehled</Heading>
        <Text style={muted}>{periodLabel}</Text>

        <Section style={card}>
          <Heading as="h2" style={h2}>Pojistné události</Heading>
          <Row label="Aktivní zakázky" value={fmt(claimsActive)} />
          <Row label="Nové (za období)" value={fmt(claimsNew)} />
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Ojeté vozy</Heading>
          <Row label="Aktivní výkupy" value={fmt(vykupyActive)} />
          <Row label="Prodáno (za období)" value={fmt(vykupySold)} />
          <Row label="Obrat" value={kc(obratKc)} />
          <Row label="Marže" value={kc(marzeKc)} />
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Závady</Heading>
          <Row label="Otevřené" value={fmt(defectsOpen)} />
          <Row label="Z toho kritické" value={fmt(defectsCritical)} highlight={defectsCritical > 0} />
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Docházka</Heading>
          <Row label="Odpracováno (za období)" value={`${dochazkaHours.toFixed(1)} h`} />
          <Row label="Čekající absence" value={fmt(absencesPending)} />
          {dppWarnings.length > 0 && (
            <>
              <Hr style={hr} />
              <Text style={{ ...muted, marginBottom: 4 }}>DPP — varování (≥270 h/rok):</Text>
              {dppWarnings.map((w) => (
                <Row key={w.name} label={w.name} value={`${w.hours.toFixed(1)} / 300 h`} highlight={w.hours >= 300} />
              ))}
            </>
          )}
        </Section>

        <Text style={muted}>
          Tento přehled chodí automaticky každé pondělí ráno. Otevřete dashboard pro detail.
        </Text>
      </Container>
    </Body>
  </Html>
)

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td style={{ padding: '6px 0', color: '#475569', fontSize: 14 }}>{label}</td>
          <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: highlight ? '#be123c' : '#0f172a', fontFamily: 'monospace' }}>{value}</td>
        </tr>
      </tbody>
    </table>
  )
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0 }
const container = { maxWidth: 600, margin: '0 auto', padding: '24px' }
const h1 = { fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }
const h2 = { fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const card = { padding: 16, marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 12 }
const muted = { color: '#64748b', fontSize: 13, marginTop: 4 }
const hr = { borderColor: '#e2e8f0', margin: '12px 0' }

export const template = {
  component: Email,
  subject: ({ periodLabel }: WeeklyReportProps) => `Autoport APP — ${periodLabel ?? 'Týdenní přehled'}`,
  displayName: 'Týdenní přehled (admin)',
  previewData: {
    periodLabel: '9.–15. června 2026',
    claimsActive: 12,
    claimsNew: 3,
    vykupyActive: 8,
    vykupySold: 2,
    obratKc: 540000,
    marzeKc: 64000,
    defectsOpen: 5,
    defectsCritical: 1,
    dochazkaHours: 412.5,
    dppWarnings: [{ name: 'Jan Novák', hours: 285 }],
    absencesPending: 2,
  },
} satisfies TemplateEntry