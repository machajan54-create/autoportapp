import React from "react";
import { Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from "./_layout";

export interface AbsenceNotificationProps {
  /** 'requested' | 'submitted' | 'approved' | 'rejected' */
  event?: "requested" | "submitted" | "approved" | "rejected";
  recipientName?: string;
  employeeName?: string;
  resolverName?: string;
  typeLabel?: string;
  startDate?: string;
  endDate?: string;
  days?: string;
  note?: string;
  actionUrl?: string;
}

const EVENT_COPY: Record<
  string,
  { heading: string; color: string; lead: (n: string) => string; subject: (t: string) => string }
> = {
  requested: {
    heading: "Nová žádost o absenci",
    color: "#b45309",
    lead: (n) => `${n || "Zaměstnanec"} podal(a) žádost o absenci ke schválení.`,
    subject: (t) => `🗓️ Nová žádost o absenci: ${t}`,
  },
  submitted: {
    heading: "Žádost odeslána",
    color: "#2563eb",
    lead: () => "Vaše žádost o absenci byla odeslána ke schválení.",
    subject: (t) => `🗓️ Vaše žádost o absenci byla odeslána: ${t}`,
  },
  approved: {
    heading: "Absence schválena",
    color: "#15803d",
    lead: (n) => `${n || "Schvalovatel"} vaši žádost o absenci schválil(a).`,
    subject: (t) => `✅ Absence schválena: ${t}`,
  },
  rejected: {
    heading: "Absence zamítnuta",
    color: "#b91c1c",
    lead: (n) => `${n || "Schvalovatel"} vaši žádost o absenci zamítl(a).`,
    subject: (t) => `❌ Absence zamítnuta: ${t}`,
  },
};

const Email = ({
  event = "requested",
  recipientName = "",
  employeeName = "",
  resolverName = "",
  typeLabel = "",
  startDate = "",
  endDate = "",
  days = "",
  note = "",
  actionUrl = "https://www.autoport-app.cz/dochazka",
}: AbsenceNotificationProps) => {
  const copy = EVENT_COPY[event] ?? EVENT_COPY.requested;
  const actor = event === "requested" ? employeeName : resolverName;
  const meta: Array<[string, string]> = [];
  if (employeeName) meta.push(["Zaměstnanec", employeeName]);
  if (typeLabel) meta.push(["Typ", typeLabel]);
  if (startDate) meta.push(["Od", startDate]);
  if (endDate) meta.push(["Do", endDate]);
  if (days) meta.push(["Počet dnů", days]);
  if (resolverName && event !== "requested" && event !== "submitted")
    meta.push(["Vyřídil", resolverName]);
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`${copy.heading}: ${typeLabel || ""}`.trim()}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={{ ...styles.h1, color: copy.color }}>{copy.heading}</Heading>
            <Text style={styles.lead}>
              {recipientName ? `Dobrý den ${recipientName}, ` : "Dobrý den, "}
              {copy.lead(actor)}
            </Text>
            {typeLabel ? <Text style={styles.title}>{typeLabel}</Text> : null}
            <Section style={styles.metaBox}>
              {meta.map(([k, v]) => (
                <Text key={k} style={styles.metaRow}>
                  <strong>{k}:</strong> {v}
                </Text>
              ))}
            </Section>
            {note ? <Text style={styles.details}>{note}</Text> : null}
            <Hr style={styles.hr} />
            <PrimaryButton href={actionUrl}>Otevřít docházku</PrimaryButton>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const ev = (d?.event as keyof typeof EVENT_COPY) ?? "requested";
    const label = [d?.typeLabel, d?.startDate && d?.endDate ? `${d.startDate}–${d.endDate}` : ""]
      .filter(Boolean)
      .join(" ");
    return (EVENT_COPY[ev] ?? EVENT_COPY.requested).subject(label);
  },
  displayName: "Absence – žádost a rozhodnutí",
  previewData: {
    event: "requested",
    employeeName: "Petr Dvořák",
    typeLabel: "Dovolená",
    startDate: "2026-08-17",
    endDate: "2026-08-21",
    days: "5",
    note: "Rodinná dovolená.",
  },
} satisfies TemplateEntry;
