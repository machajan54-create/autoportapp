import React from 'react'
import { Body, Container, Section, Text, Link, Hr, Img } from '@react-email/components'

export const BRAND = {
  name: 'Autoport App',
  url: 'https://www.autoport-app.cz',
  logoUrl:
    'https://www.autoport-app.cz/__l5e/assets-v1/19ff4770-3afd-4865-9129-e2762e7572bc/autoport-logo.png',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  ink: '#0f172a',
  sub: '#475569',
  muted: '#94a3b8',
  line: '#e2e8f0',
  surface: '#f8fafc',
  bg: '#f1f5f9',
}

export const styles = {
  body: {
    backgroundColor: BRAND.bg,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
    margin: 0,
    padding: '24px 0',
    color: BRAND.ink,
  } as React.CSSProperties,
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: '14px',
    overflow: 'hidden',
    border: `1px solid ${BRAND.line}`,
  } as React.CSSProperties,
  header: {
    background: '#ffffff',
    padding: '20px 24px',
    borderBottom: `1px solid ${BRAND.line}`,
    textAlign: 'center' as const,
  } as React.CSSProperties,
  logo: {
    height: '40px',
    width: 'auto',
    margin: '0 auto',
    display: 'block',
  } as React.CSSProperties,
  brand: {
    color: BRAND.primary,
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    margin: 0,
    textTransform: 'uppercase' as const,
  },
  content: { padding: '24px 28px 8px' } as React.CSSProperties,
  h1: {
    fontSize: '20px',
    color: BRAND.ink,
    margin: '4px 0 12px',
    lineHeight: 1.3,
    fontWeight: 700,
  } as React.CSSProperties,
  lead: {
    fontSize: '15px',
    color: BRAND.sub,
    lineHeight: 1.55,
    margin: '0 0 12px',
  } as React.CSSProperties,
  title: {
    fontSize: '17px',
    fontWeight: 600,
    color: BRAND.ink,
    margin: '8px 0',
  } as React.CSSProperties,
  metaBox: {
    background: BRAND.surface,
    border: `1px solid ${BRAND.line}`,
    borderRadius: '10px',
    padding: '14px 16px',
    margin: '14px 0',
  } as React.CSSProperties,
  metaRow: {
    fontSize: '14px',
    color: BRAND.ink,
    margin: '4px 0',
    lineHeight: 1.5,
  } as React.CSSProperties,
  details: {
    fontSize: '14px',
    color: BRAND.sub,
    margin: '12px 0',
    whiteSpace: 'pre-wrap' as const,
    lineHeight: 1.55,
  } as React.CSSProperties,
  hr: { borderColor: BRAND.line, margin: '20px 0' } as React.CSSProperties,
  ctaWrap: { textAlign: 'center' as const, margin: '8px 0 20px' } as React.CSSProperties,
  btn: {
    background: BRAND.primary,
    color: '#ffffff',
    padding: '12px 22px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
    display: 'inline-block',
  } as React.CSSProperties,
  footer: {
    padding: '16px 24px 22px',
    borderTop: `1px solid ${BRAND.line}`,
    background: BRAND.surface,
  } as React.CSSProperties,
  footerText: {
    fontSize: '12px',
    color: BRAND.muted,
    textAlign: 'center' as const,
    margin: '2px 0',
    lineHeight: 1.5,
  } as React.CSSProperties,
  footerLink: { color: BRAND.primary, textDecoration: 'none' } as React.CSSProperties,
}

export function Header() {
  return (
    <Section style={styles.header}>
      <Img
        src={BRAND.logoUrl}
        alt={BRAND.name}
        height={40}
        style={styles.logo}
      />
    </Section>
  )
}

export function Footer({ note }: { note?: string }) {
  return (
    <Section style={styles.footer}>
      {note ? <Text style={styles.footerText}>{note}</Text> : null}
      <Text style={styles.footerText}>
        <Link href={BRAND.url} style={styles.footerLink}>{BRAND.url.replace(/^https?:\/\//, '')}</Link>
      </Text>
      <Text style={styles.footerText}>Tento e-mail je automaticky generovaná notifikace.</Text>
    </Section>
  )
}

export function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={styles.ctaWrap}>
      <Link href={href} style={styles.btn}>
        {children}
      </Link>
    </Section>
  )
}

export { Body, Container, Hr }