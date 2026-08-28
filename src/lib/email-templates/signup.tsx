import * as React from "react";
import { Head, Heading, Html, Preview, Text } from "@react-email/components";
import { Body, Container, Footer, Header, PrimaryButton, styles } from "./_layout";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export const SignupEmail = ({ siteName, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Potvrďte svou e-mailovou adresu</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Header />
        <div style={styles.content}>
          <Heading style={styles.h1}>Potvrďte svou e-mailovou adresu</Heading>
          <Text style={styles.lead}>
            Děkujeme za registraci v aplikaci {siteName}. Potvrďte prosím adresu {recipient}{" "}
            kliknutím na tlačítko níže.
          </Text>
          <PrimaryButton href={confirmationUrl}>Potvrdit e-mail</PrimaryButton>
          <Text style={styles.lead}>
            Pokud jste si účet nezakládali, tento e-mail můžete ignorovat.
          </Text>
        </div>
        <Footer />
      </Container>
    </Body>
  </Html>
);

export default SignupEmail;
