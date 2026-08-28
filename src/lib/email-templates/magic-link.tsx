import * as React from "react";
import { Head, Heading, Html, Preview, Text } from "@react-email/components";
import { Body, Container, Footer, Header, PrimaryButton, styles } from "./_layout";

interface MagicLinkEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Přihlašovací odkaz do aplikace {siteName}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Header />
        <div style={styles.content}>
          <Heading style={styles.h1}>Přihlášení do aplikace {siteName}</Heading>
          <Text style={styles.lead}>
            Kliknutím na tlačítko níže se přihlásíte. Odkaz je platný pouze omezenou dobu.
          </Text>
          <PrimaryButton href={confirmationUrl}>Přihlásit se</PrimaryButton>
          <Text style={styles.lead}>
            Pokud jste o přihlášení nežádali, tento e-mail můžete ignorovat.
          </Text>
        </div>
        <Footer />
      </Container>
    </Body>
  </Html>
);

export default MagicLinkEmail;
