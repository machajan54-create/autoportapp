import React from "react";
import { Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from "./_layout";

export interface CleaningDailyProps {
  assigneeName?: string;
  todayDate?: string;
  tasks?: Array<{ title: string; note?: string | null; frequency?: string | null }>;
  actionUrl?: string;
}

const Email = ({
  assigneeName = "",
  todayDate = "",
  tasks = [],
  actionUrl = "https://www.autoport-app.cz/uklid",
}: CleaningDailyProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>{`Úklid na dnešek: ${tasks.length} úkolů`}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.content}>
          <Heading style={styles.h1}>Úklidový checklist na dnešek</Heading>
          <Text style={styles.lead}>
            {assigneeName ? `Dobrý den ${assigneeName}, ` : "Dobrý den, "}
            máte na dnešní den ({todayDate}) přiřazené tyto úkoly.
          </Text>
          <Section style={styles.metaBox}>
            {tasks.map((t, i) => (
              <Text key={`${t.title}-${i}`} style={styles.metaRow}>
                <strong>{t.title}</strong>
                {t.note ? ` – ${t.note}` : ""}
              </Text>
            ))}
          </Section>
          <Hr style={styles.hr} />
          <PrimaryButton href={actionUrl}>Otevřít checklist</PrimaryButton>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Úklid na dnešek – ${Array.isArray(d?.tasks) ? d.tasks.length : 0} úkolů`,
  displayName: "Úklid – denní checklist",
  previewData: {
    assigneeName: "Jan Novák",
    todayDate: "22. 9. 2026",
    tasks: [
      { title: "Vysát showroom", note: "Včetně předváděcích vozů" },
      { title: "Doplnit kávu a vodu" },
    ],
    actionUrl: "https://www.autoport-app.cz/uklid",
  },
} satisfies TemplateEntry;
