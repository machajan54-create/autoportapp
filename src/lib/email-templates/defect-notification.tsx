import React from "react";
import { Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from "./_layout";

export interface DefectNotificationProps {
  recipientName?: string;
  reporterName?: string;
  resolverName?: string;
  title?: string;
  description?: string;
  priorityLabel?: string;
  statusLabel?: string;
  resolutionNote?: string;
  /** 'reported' | 'in_progress' | 'resolved' | 'closed' */
  event?: "reported" | "in_progress" | "resolved" | "closed";
  actionUrl?: string;
}

const EVENT_COPY: Record<
  string,
  { heading: string; color: string; lead: (a: string) => string; subject: (t: string) => string }
> = {
  reported: {
    heading: "Nová závada",
    color: "#b91c1c",
    lead: (a) => `${a || "Kolega"} nahlásil(a) novou závadu.`,
    subject: (t) => `🛠️ Nová závada: ${t}`,
  },
  in_progress: {
    heading: "Závada se řeší",
    color: "#2563eb",
    lead: (a) => `${a || "Kolega"} začal(a) vaši závadu řešit.`,
    subject: (t) => `▶️ Závada v řešení: ${t}`,
  },
  resolved: {
    heading: "Závada vyřešena",
    color: "#15803d",
    lead: (a) => `${a || "Kolega"} označil(a) vaši závadu za vyřešenou.`,
    subject: (t) => `✅ Závada vyřešena: ${t}`,
  },
  closed: {
    heading: "Závada uzavřena",
    color: "#475569",
    lead: (a) => `${a || "Kolega"} závadu uzavřel(a).`,
    subject: (t) => `📁 Závada uzavřena: ${t}`,
  },
};

const Email = ({
  recipientName = "",
  reporterName = "",
  resolverName = "",
  title = "",
  description = "",
  priorityLabel,
  statusLabel,
  resolutionNote = "",
  event = "reported",
  actionUrl = "https://www.autoport-app.cz/zavady",
}: DefectNotificationProps) => {
  const copy = EVENT_COPY[event] ?? EVENT_COPY.reported;
  const actor = event === "reported" ? reporterName : resolverName;
  const meta: Array<[string, string]> = [];
  if (reporterName) meta.push(["Nahlásil", reporterName]);
  if (priorityLabel) meta.push(["Priorita", priorityLabel]);
  if (statusLabel) meta.push(["Stav", statusLabel]);
  if (resolverName && event !== "reported") meta.push(["Řešil", resolverName]);
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`${copy.heading}: ${title || ""}`.trim()}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={{ ...styles.h1, color: copy.color }}>{copy.heading}</Heading>
            <Text style={styles.lead}>
              {recipientName ? `Dobrý den ${recipientName}, ` : "Dobrý den, "}
              {copy.lead(actor)}
            </Text>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <Section style={styles.metaBox}>
              {meta.map(([k, v]) => (
                <Text key={k} style={styles.metaRow}>
                  <strong>{k}:</strong> {v}
                </Text>
              ))}
            </Section>
            {description ? <Text style={styles.details}>{description}</Text> : null}
            {resolutionNote ? <Text style={styles.details}>{resolutionNote}</Text> : null}
            <Hr style={styles.hr} />
            <PrimaryButton href={actionUrl}>Otevřít závady</PrimaryButton>
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
    const ev = (d?.event as keyof typeof EVENT_COPY) ?? "reported";
    return (EVENT_COPY[ev] ?? EVENT_COPY.reported).subject(d?.title || "");
  },
  displayName: "Závada – nahlášení a změna stavu",
  previewData: {
    recipientName: "Jan Novák",
    reporterName: "Petr Dvořák",
    title: "Prasklé světlo v dílně",
    description: "Nesvítí zářivka nad zvedákem 2.",
    priorityLabel: "Vysoká",
    statusLabel: "Nová",
    event: "reported",
    actionUrl: "https://www.autoport-app.cz/zavady",
  },
} satisfies TemplateEntry;
