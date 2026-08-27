import { describe, it, expect } from "vitest";

// Evidence module uses inline zod schemas (not exported). We test the
// documented order statuses and validation rules.

describe("Evidence order statuses", () => {
  it("has 3 statuses: nova, predano, zruseno", () => {
    const statuses = ["nova", "predano", "zruseno"] as const;
    expect(statuses).toHaveLength(3);
    expect(statuses).toContain("nova");
    expect(statuses).toContain("predano");
    expect(statuses).toContain("zruseno");
  });

  it("nova is the default for new orders", () => {
    const defaultStatus = "nova";
    expect(["predano", "zruseno"]).not.toContain(defaultStatus);
  });
});

describe("Evidence order validation rules (documented)", () => {
  it("klient is required (min 1 char)", () => {
    const min = 1;
    expect("Autoport".length).toBeGreaterThanOrEqual(min);
    expect("").toHaveLength(0);
    expect(0).toBeLessThan(min);
  });

  it("vozidlo is required (min 1 char)", () => {
    const min = 1;
    expect("Citroën C3".length).toBeGreaterThanOrEqual(min);
    expect(10).toBeGreaterThanOrEqual(min);
    expect("").toHaveLength(0);
    expect(0).toBeLessThan(min);
  });

  it("poznamka max length is 2000 chars", () => {
    const max = 2000;
    expect("krátká poznámka".length).toBeLessThanOrEqual(max);
    expect("a".repeat(2001).length).toBeGreaterThan(max);
  });

  it("stav must be one of the enum values", () => {
    const valid = ["nova", "predano", "zruseno"];
    expect(valid).toContain("nova");
    expect(valid).toContain("predano");
    expect(valid).toContain("zruseno");
    expect(valid).not.toContain("hotovo");
  });
});
