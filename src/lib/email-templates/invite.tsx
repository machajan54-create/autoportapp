import * as React from "react";
import { Head, Heading, Html, Preview, Text } from "@react-email/components";
import { Body, Container, Footer, Header, PrimaryButton, styles } from "./_layout";

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ siteName, confirmationUrl }: InviteEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Byli jste pozváni do aplikace {siteName}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Header />
        <div style={styles.content}>
          <Heading style={styles.h1}>Pozvánka do aplikace {siteName}</Heading>
          <Text style={styles.lead}>
            Byli jste pozváni do aplikace {siteName}. Účet aktivujete kliknutím na tlačítko níže.
          </Text>
          <PrimaryButton href={confirmationUrl}>Přijmout pozvánku</PrimaryButton>
          <Text style={styles.lead}>
            Pokud jste pozvánku nečekali, tento e-mail můžete ignorovat.
          </Text>
        </div>
        <Footer />
      </Container>
    </Body>
  </Html>
);

export default InviteEmail;
