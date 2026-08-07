import React from "react";
import { Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Body, Container, Footer, Header, Hr, PrimaryButton, styles } from "./_layout";

export interface TaskCommentProps {
  recipientName?: string;
  authorName?: string;
  title?: string;
  body?: string;
  actionUrl?: string;
}

const Email = ({
  recipientName = "",
  authorName = "Kolega",
  title = "",
  body = "",
  actionUrl = "https://www.autoport-app.cz/ukoly",
}: TaskCommentProps) => {
  return (
    <Html lang="cs" dir="ltr">
      <Head />
      <Preview>{`Nový komentář: ${title || ""}`.trim()}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.content}>
            <Heading style={styles.h1}>Nový komentář k úkolu</Heading>
            <Text style={styles.lead}>
              {recipientName ? `Dobrý den ${recipientName}, ` : "Dobrý den, "}
              {authorName} přidal(a) komentář k úkolu.
            </Text>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <Section style={styles.metaBox}>
              <Text style={styles.metaRow}>
                <strong>{authorName}:</strong>
              </Text>
              <Text style={styles.details}>{body}</Text>
            </Section>
            <Hr style={styles.hr} />
            <PrimaryButton href={actionUrl}>Otevřít úkol</PrimaryButton>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `💬 Nový komentář: ${d?.title || ""}`.trim(),
  displayName: "Nový komentář k úkolu",
  previewData: {
    recipientName: "Jan Novák",
    authorName: "Petr Admin",
    title: "Doplnit dokumenty",
    body: "Prosím dodat do konce týdne, díky!",
  },
} satisfies TemplateEntry;
