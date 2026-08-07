import React from "react";
import { Head, Heading, Html, Preview, Section, Text, Link } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Body, Container, Footer, Header, Hr, styles } from "./_layout";

export interface WashReminderProps {
  recipientName?: string;
  klient?: string;
  vozidlo?: string;
  vis?: string;
  pickupFrom?: string;
  completeBy?: string;
  den?: string;
  hodina?: string;
  cisloZakazky?: string;
  poznamka?: string;
  acceptUrl?: string;
  declineUrl?: string;
  reminderNumber?: number;
}

const Email = ({
  recipientName = "",
  klient = "",
  vozidlo = "",
  vis = "",
  pickupFrom = "",
  completeBy = "",
  den = "",
  hodina = "",
  cisloZakazky = "",
  poznamka = "",
  acceptUrl = "#",
  declineUrl = "#",
  reminderNumber = 1,
}: WashReminderProps) => {
  const meta = [
    klient && { label: "Klient", value: klient },
    vozidlo && { label: "Vozidlo", value: vozidlo },
    vis && { label: "VIS / SPZ", value: vis },
    pickupFrom && { label: "Vyzvednutí od", value: pickupFrom },
    completeBy && { label: "Dokončit do", value: completeBy },
    den && { label: "Den", value: den },
    hodina && { label: "Hodina", value: hodina },
    cisloZakazky && { label: "Č. zakázky", value: cisloZakazky },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`Připomínka mytí – ${vozidlo || ""}`.trim()}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>Připomínka: nepotvrzené mytí</Heading>
            {recipientName ? <Text style={styles.lead}>Dobrý den {recipientName},</Text> : null}
            <Text style={styles.lead}>
              Stále evidujeme nepotvrzenou zakázku k mytí (upozornění č. {reminderNumber}). Prosíme
              o potvrzení nebo odmítnutí — víme tak, jestli s tím počítáte.
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
            <Section style={{ textAlign: "center" as const, margin: "8px 0 20px" }}>
              <Link
                href={acceptUrl}
                style={{ ...styles.btn, background: "#16a34a", marginRight: 8 }}
              >
                Přijímám
              </Link>
              <Link href={declineUrl} style={{ ...styles.btn, background: "#dc2626" }}>
                Odmítám
              </Link>
            </Section>
            <Text style={{ ...styles.footerText, textAlign: "center" as const }}>
              Dokud zakázku nepotvrdíte nebo neodmítnete, budeme připomínku posílat každý den.
            </Text>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Připomínka mytí${d?.vozidlo ? ` – ${d.vozidlo}` : ""}`,
  displayName: "Připomínka mytí (myč)",
  previewData: {
    recipientName: "Karpich",
    klient: "ČSOB Veolia",
    vozidlo: "Jumper",
    vis: "TG033272",
    pickupFrom: "15.6.2026 9:00",
    completeBy: "16.6.2026 17:00",
    cisloZakazky: "CT6306",
    poznamka: "",
    acceptUrl: "https://www.autoport-app.cz/wash-respond/accept/demo",
    declineUrl: "https://www.autoport-app.cz/wash-respond/decline/demo",
    reminderNumber: 2,
  },
} satisfies TemplateEntry;
