import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Obnovení hesla pro {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Obnovení hesla</Heading>
        <Text style={text}>
          Obdrželi jsme žádost o obnovení hesla k vašemu účtu v aplikaci {siteName}. Pro nastavení
          nového hesla klikněte na tlačítko níže.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Nastavit nové heslo
        </Button>
        <Text style={footer}>
          Pokud jste o obnovení hesla nežádali, tento e-mail můžete ignorovat — vaše heslo zůstane
          beze změny.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default RecoveryEmail;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "20px 25px" };
const h1 = {
  fontSize: "22px",
  fontWeight: "bold" as const,
  color: "#000000",
  margin: "0 0 20px",
};
const text = {
  fontSize: "14px",
  color: "#55575d",
  lineHeight: "1.5",
  margin: "0 0 25px",
};
const button = {
  backgroundColor: "#000000",
  color: "#ffffff",
  fontSize: "14px",
  borderRadius: "8px",
  padding: "12px 20px",
  textDecoration: "none",
};
const footer = { fontSize: "12px", color: "#999999", margin: "30px 0 0" };
