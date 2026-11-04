import { describe, expect, it } from "vitest";
import { followUpDate, normalizeInbound, pickClient } from "../inbound-email";

describe("inbound email → deal", () => {
  const mail = normalizeInbound({
    From: "Lukáš <lukas@autoport.cz>",
    To: "Jan Novák <jan@klient.cz>",
    Cc: "crm@autoport-app.cz",
    Subject: "Nabídka",
  })!;

  it("klient je adresát mimo zaměstnance a CRM schránku", () => {
    expect(pickClient(mail, new Set(["lukas@autoport.cz"]), "autoport-app.cz")?.email).toBe("jan@klient.cz");
  });

  it("follow-up je za 3 dny", () => {
    expect(followUpDate(new Date(2026, 10, 4, 18)).getDate()).toBe(7);
  });
});
