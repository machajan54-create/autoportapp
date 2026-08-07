import React from "react";
import { Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from "./_layout";

export interface FollowupReminderProps {
  recipientName?: string;
  entityType?: "vykup" | "deal";
  title?: string;
  subtitle?: string;
  followUpAt?: string;
  actionUrl?: string;
}

const Email = ({
  recipientName = "",
  entityType = "vykup",
  title = "",
  subtitle = "",
  followUpAt = "",
  actionUrl = "https://www.autoport-app.cz",
}: FollowupReminderProps) => {
  const label = entityType === "deal" ? "obchodnimu pripadu" : "vykupu";
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`Pripomenuti follow-upu: ${title || ""}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>Pripomenuti follow-upu</Heading>
            <Text style={styles.lead}>
              {recipientName ? `Dobry den ${recipientName}, ` : "Dobry den, "}
              naplanovany follow-up k {label} je dnes.
            </Text>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.details}>{subtitle}</Text> : null}
            <Section style={styles.metaBox}>
              {followUpAt ? (
                <Text style={styles.metaRow}>
                  <strong>Termin:</strong> {followUpAt}
                </Text>
              ) : null}
            </Section>
            <Hr style={styles.hr} />
            <PrimaryButton href={actionUrl}>Otevrit detail</PrimaryButton>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Připomenutí follow-upu: ${d?.title || "záznam"}`,
  displayName: "Připomenutí follow-upu (výkup/obchod)",
  previewData: {
    recipientName: "Jan Novák",
    entityType: "vykup",
    title: "Citroen C3 — Petr Svoboda",
    subtitle: "Domluveno volání ohledně technického stavu",
    followUpAt: "20. 6. 2026 10:00",
    actionUrl: "https://www.autoport-app.cz/vykupy",
  },
} satisfies TemplateEntry;
