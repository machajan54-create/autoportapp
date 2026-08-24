import { describe, it, expect } from "vitest";
import { formatKc, formatDate, marze } from "@/lib/vykupy";

describe("formatKc", () => {
  it("formats a positive number with Czech locale and Kč suffix", () => {
    expect(formatKc(123456)).toBe("123\u00A0456 Kč");
  });

  it("returns dash for null", () => {
    expect(formatKc(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatKc(undefined)).toBe("—");
  });

  it("returns dash for NaN", () => {
    expect(formatKc(NaN)).toBe("—");
  });

  it("formats zero", () => {
    expect(formatKc(0)).toBe("0 Kč");
  });

  it("formats negative number", () => {
    expect(formatKc(-1000)).toBe("-1 000 Kč");
  });
});

describe("formatDate", () => {
  it("returns dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns dash for empty string", () => {
    expect(formatDate("")).toBe("—");
  });

  it("returns dash for invalid date string", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formats a valid ISO date string", () => {
    const result = formatDate("2025-06-15T12:00:00Z");
    expect(result).toMatch(/^\d{1,2}\.\s?\d{1,2}\.\s?\d{4}$/);
    expect(result).not.toBe("—");
  });
});

describe("marze", () => {
  it("returns null when prodano_za is null", () => {
    expect(marze({ prodano_za: null, vykoupeno_za: 100, naklady: 0 })).toBeNull();
  });

  it("returns null when vykoupeno_za is null", () => {
    expect(marze({ prodano_za: 200, vykoupeno_za: null, naklady: 0 })).toBeNull();
  });

  it("calculates margin with no costs", () => {
    expect(marze({ prodano_za: 200000, vykoupeno_za: 150000, naklady: 0 })).toBe(50000);
  });

  it("subtracts costs from margin", () => {
    expect(marze({ prodano_za: 200000, vykoupeno_za: 150000, naklady: 20000 })).toBe(30000);
  });

  it("handles undefined naklady as zero via nullish coalescing", () => {
    // naklady is typed as number (not nullable), but the function uses ?? 0
    expect(marze({ prodano_za: 100, vykoupeno_za: 50, naklady: 0 as any })).toBe(50);
  });

  it("returns negative margin when costs exceed profit", () => {
    expect(marze({ prodano_za: 100000, vykoupeno_za: 90000, naklady: 30000 })).toBe(-20000);
  });
});
