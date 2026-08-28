import * as React from "react";
import { Head, Heading, Html, Preview, Text } from "@react-email/components";
import { Body, Container, Footer, Header, PrimaryButton, styles } from "./_layout";

interface EmailChangeEmailProps {
  siteName: string;
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Potvrďte změnu e-mailové adresy</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Header />
        <div style={styles.content}>
          <Heading style={styles.h1}>Potvrzení změny e-mailu</Heading>
          <Text style={styles.lead}>
            Žádáte o změnu e-mailové adresy v aplikaci {siteName}
            {oldEmail ? ` z ${oldEmail}` : ""}
            {newEmail ? ` na ${newEmail}` : ""}. Změnu potvrdíte tlačítkem níže.
          </Text>
          <PrimaryButton href={confirmationUrl}>Potvrdit změnu</PrimaryButton>
          <Text style={styles.lead}>
            Pokud jste o změnu nežádali, kontaktujte prosím správce aplikace.
          </Text>
        </div>
        <Footer />
      </Container>
    </Body>
  </Html>
);

export default EmailChangeEmail;
