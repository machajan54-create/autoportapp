import { describe, it, expect } from "vitest";
import { CLAIM_STATUS_LABEL } from "@/lib/claims.functions";

describe("CLAIM_STATUS_LABEL", () => {
  it("has Czech labels for all claim statuses", () => {
    expect(CLAIM_STATUS_LABEL.new).toBe("Nová");
    expect(CLAIM_STATUS_LABEL.in_progress).toBe("V řešení");
    expect(CLAIM_STATUS_LABEL.in_repair).toBe("V opravě");
    expect(CLAIM_STATUS_LABEL.waiting_vat).toBe("Čeká na DPH");
    expect(CLAIM_STATUS_LABEL.done).toBe("Hotovo");
    expect(CLAIM_STATUS_LABEL.closed).toBe("Uzavřeno");
  });

  it("has exactly 6 statuses", () => {
    expect(Object.keys(CLAIM_STATUS_LABEL)).toHaveLength(6);
  });

  it("has no empty labels", () => {
    for (const v of Object.values(CLAIM_STATUS_LABEL)) {
      expect(v.length).toBeGreaterThan(0);
    }
  });
});
