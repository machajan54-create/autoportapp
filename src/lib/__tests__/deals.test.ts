import { describe, it, expect } from "vitest";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABEL,
  DEAL_VEHICLES,
  formatDuration,
} from "@/lib/deals.functions";

describe("DEAL_STAGES", () => {
  it("has 5 stages in pipeline order", () => {
    expect(DEAL_STAGES).toEqual(["lead", "contacted", "offer", "won", "lost"]);
  });
});

describe("DEAL_STAGE_LABEL", () => {
  it("has Czech labels for all stages", () => {
    expect(DEAL_STAGE_LABEL.lead).toBe("Lead");
    expect(DEAL_STAGE_LABEL.contacted).toBe("Kontaktován");
    expect(DEAL_STAGE_LABEL.offer).toBe("Nabídka");
    expect(DEAL_STAGE_LABEL.won).toBe("Vyhráno");
    expect(DEAL_STAGE_LABEL.lost).toBe("Ztraceno");
  });

  it("has a label for every stage", () => {
    for (const s of DEAL_STAGES) {
      expect(DEAL_STAGE_LABEL[s]).toBeTruthy();
    }
  });
});

describe("DEAL_VEHICLES", () => {
  it("contains Citroën models", () => {
    expect(DEAL_VEHICLES.length).toBeGreaterThan(0);
    expect(DEAL_VEHICLES.every((v) => v.startsWith("Citroën"))).toBe(true);
  });

  it("includes C3 and C5 Aircross", () => {
    expect(DEAL_VEHICLES).toContain("Citroën C3");
    expect(DEAL_VEHICLES).toContain("Citroën C5 Aircross");
  });
});

describe("formatDuration", () => {
  it("returns dash for zero", () => {
    expect(formatDuration(0)).toBe("—");
  });

  it("returns dash for negative", () => {
    expect(formatDuration(-1000)).toBe("—");
  });

  it("returns dash for NaN", () => {
    expect(formatDuration(NaN)).toBe("—");
  });

  it("formats seconds", () => {
    expect(formatDuration(5_000)).toBe("5 s");
  });

  it("formats minutes", () => {
    expect(formatDuration(125_000)).toBe("2 min");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3_661_000)).toBe("1 h 1 min");
  });

  it("formats days and hours", () => {
    expect(formatDuration(90_061_000)).toBe("1 d 1 h");
  });
});
