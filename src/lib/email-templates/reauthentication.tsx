import * as React from "react";
import { Head, Heading, Html, Preview, Text } from "@react-email/components";
import { Body, Container, Footer, Header, styles } from "./_layout";

interface ReauthenticationEmailProps {
  token: string;
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Váš ověřovací kód</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Header />
        <div style={styles.content}>
          <Heading style={styles.h1}>Ověřovací kód</Heading>
          <Text style={styles.lead}>Pro dokončení ověření zadejte tento kód:</Text>
          <Text style={{ ...styles.h1, letterSpacing: "6px", textAlign: "center" as const }}>
            {token}
          </Text>
          <Text style={styles.lead}>
            Pokud jste o ověření nežádali, tento e-mail můžete ignorovat.
          </Text>
        </div>
        <Footer />
      </Container>
    </Body>
  </Html>
);

export default ReauthenticationEmail;
