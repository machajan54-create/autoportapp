import React from "react";
import { Head, Heading, Html, Preview, Section, Text, Link } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Body, Container, Footer, Header, Hr, styles } from "./_layout";

interface Props {
  recipientName?: string;
  orderNumber?: string;
  modelVerze?: string;
  orderUrl?: string | null;
  invoiceUrl?: string | null;
}

const Email = ({
  recipientName = "",
  orderNumber = "",
  modelVerze = "",
  orderUrl,
  invoiceUrl,
}: Props) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Dokumenty k Vaší objednávce předváděcího vozu</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.content}>
          <Heading style={styles.h1}>Vaše dokumenty k objednávce</Heading>
          <Text style={styles.lead}>
            {recipientName ? `Dobrý den ${recipientName},` : "Dobrý den,"}
          </Text>
          <Text style={styles.lead}>
            níže najdete odkazy ke stažení dokumentů k objednávce <strong>{orderNumber}</strong>
            {modelVerze ? ` (${modelVerze})` : ""}. Odkazy platí 7 dní.
          </Text>
          <Hr style={styles.hr} />
          {orderUrl ? (
            <Text style={styles.metaRow}>
              📄{" "}
              <Link href={orderUrl} style={{ color: "#2563eb" }}>
                Stáhnout podepsanou objednávku
              </Link>
            </Text>
          ) : null}
          {invoiceUrl ? (
            <Text style={styles.metaRow}>
              🧾{" "}
              <Link href={invoiceUrl} style={{ color: "#2563eb" }}>
                Stáhnout zálohovou fakturu
              </Link>
            </Text>
          ) : null}
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Dokumenty k Vaší objednávce",
  displayName: "Objednávka – dokumenty pro klienta",
  previewData: {
    recipientName: "Jan Novák",
    orderNumber: "OBJ-2026-0001",
    modelVerze: "C5 Aircross",
    orderUrl: "https://example.com/o.pdf",
    invoiceUrl: "https://example.com/f.pdf",
  },
} satisfies TemplateEntry;
