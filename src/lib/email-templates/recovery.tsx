import * as React from "react";
import { Head, Heading, Html, Preview, Text } from "@react-email/components";
import { Body, Container, Footer, Header, PrimaryButton, styles } from "./_layout";

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Obnovení hesla do aplikace {siteName}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Header />
        <div style={styles.content}>
          <Heading style={styles.h1}>Obnovení hesla</Heading>
          <Text style={styles.lead}>
            Obdrželi jsme žádost o obnovení hesla k vašemu účtu v aplikaci {siteName}. Nové heslo si
            nastavíte kliknutím na tlačítko níže.
          </Text>
          <PrimaryButton href={confirmationUrl}>Nastavit nové heslo</PrimaryButton>
          <Text style={styles.lead}>
            Pokud jste o obnovení hesla nežádali, tento e-mail můžete ignorovat.
          </Text>
        </div>
        <Footer />
      </Container>
    </Body>
  </Html>
);

export default RecoveryEmail;
