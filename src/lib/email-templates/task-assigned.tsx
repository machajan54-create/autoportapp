import React from "react";
import { Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from "./_layout";

export interface TaskAssignedProps {
  assigneeName?: string;
  assignerName?: string;
  title?: string;
  description?: string;
  priorityLabel?: string;
  dueDate?: string | null;
  actionUrl?: string;
  context?: "task" | "request";
}

const Email = ({
  assigneeName = "",
  assignerName = "Kolega",
  title = "",
  description = "",
  priorityLabel,
  dueDate,
  actionUrl = "https://www.autoport-app.cz/ukoly",
  context = "task",
}: TaskAssignedProps) => {
  const what = context === "request" ? "nový požadavek" : "nový úkol";
  const heading = context === "request" ? "Nový požadavek pro Vás" : "Nový úkol pro Vás";
  const meta: Array<[string, string]> = [];
  if (priorityLabel) meta.push(["Priorita", priorityLabel]);
  if (dueDate) meta.push(["Termín", dueDate]);
  meta.push(["Zadal/a", assignerName]);
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`${heading}: ${title || ""}`.trim()}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>{heading}</Heading>
            <Text style={styles.lead}>
              {assigneeName ? `Dobrý den ${assigneeName}, ` : "Dobrý den, "}
              byl Vám přiřazen {what} v Autoport App.
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
            <Hr style={styles.hr} />
            <PrimaryButton href={actionUrl}>Otevřít v Autoport App</PrimaryButton>
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
    const what = d?.context === "request" ? "požadavek" : "úkol";
    return `Nový ${what}: ${d?.title || "Autoport App"}`;
  },
  displayName: "Přiřazení úkolu / požadavku (uživatel)",
  previewData: {
    assigneeName: "Jan Novák",
    assignerName: "Petr Admin",
    title: "Doplnit dokumenty k vozu Octavia",
    description: "Naskenovat TP a velký TP, uložit do karty výkupu.",
    priorityLabel: "Vysoká",
    dueDate: "20. 6. 2026",
    actionUrl: "https://www.autoport-app.cz/ukoly",
    context: "task",
  },
} satisfies TemplateEntry;
