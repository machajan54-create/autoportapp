import { describe, it, expect } from "vitest";
import {
  initials,
  formatTime,
  formatDate,
  formatHours,
  calculateHoursWorked,
  shiftDurationHours,
  expectedHoursWorked,
  underTime,
  todayISODate,
  ABSENCE_TYPE_LABEL,
} from "@/lib/dochazka";

describe("initials", () => {
  it("returns two-letter initials for first and last name", () => {
    expect(initials("Jan Novák")).toBe("JN");
  });

  it("returns first two chars for single name", () => {
    expect(initials("Petr")).toBe("PE");
  });

  it("handles extra whitespace", () => {
    expect(initials("  Marie   Smith  ")).toBe("MS");
  });

  it("handles three-part name (uses first and last)", () => {
    expect(initials("Jan Karl Novák")).toBe("JN");
  });
});

describe("formatTime", () => {
  it("returns dash for null", () => {
    expect(formatTime(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatTime(undefined)).toBe("—");
  });

  it("formats a valid ISO time to HH:MM", () => {
    const result = formatTime("2025-06-15T08:30:00");
    expect(result).toMatch(/^\d{1,2}:\d{2}$/);
    expect(result).not.toBe("—");
  });
});

describe("formatDate", () => {
  it("returns dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns dash for invalid date", () => {
    expect(formatDate("garbage")).toBe("—");
  });

  it("formats a valid ISO date", () => {
    const result = formatDate("2025-06-15T12:00:00Z");
    expect(result).toMatch(/^\d{1,2}\.\s?\d{1,2}\.\s?\d{4}$/);
  });
});

describe("formatHours", () => {
  it("returns dash for null", () => {
    expect(formatHours(null)).toBe("—");
  });

  it("formats whole hours", () => {
    expect(formatHours(8)).toBe("8h 0m");
  });

  it("formats fractional hours with minutes", () => {
    expect(formatHours(8.5)).toBe("8h 30m");
  });

  it("formats 8.25 hours as 8h 15m", () => {
    expect(formatHours(8.25)).toBe("8h 15m");
  });
});

describe("calculateHoursWorked", () => {
  it("calculates net hours with break deducted", () => {
    // 9:00 to 17:00 = 8 hours, minus 30 min break = 7.5
    const result = calculateHoursWorked("2025-06-15T09:00:00", "2025-06-15T17:00:00", 30);
    expect(result).toBe(7.5);
  });

  it("returns 0 when checkout is before or equal to checkin", () => {
    expect(calculateHoursWorked("2025-06-15T09:00:00", "2025-06-15T09:00:00", 0)).toBe(0);
  });

  it("returns 0 when checkout is before checkin", () => {
    expect(calculateHoursWorked("2025-06-15T17:00:00", "2025-06-15T09:00:00", 0)).toBe(0);
  });

  it("deducts full break even if it exceeds the worked time (clamped to 0)", () => {
    // 1 hour worked, 120 min break → net negative → clamped to 0
    const result = calculateHoursWorked("2025-06-15T09:00:00", "2025-06-15T10:00:00", 120);
    expect(result).toBe(0);
  });

  it("handles no break (0 minutes)", () => {
    expect(calculateHoursWorked("2025-06-15T08:00:00", "2025-06-15T16:00:00", 0)).toBe(8);
  });
});

describe("shiftDurationHours", () => {
  it("calculates duration for a day shift", () => {
    expect(shiftDurationHours("08:00", "16:00")).toBe(8);
  });

  it("wraps around midnight for night shift", () => {
    expect(shiftDurationHours("22:00", "06:00")).toBe(8);
  });

  it("returns 0 for invalid input", () => {
    expect(shiftDurationHours("abc", "12:00")).toBe(0);
  });

  it("handles same start and end (0 duration)", () => {
    expect(shiftDurationHours("08:00", "08:00")).toBe(0);
  });
});

describe("expectedHoursWorked", () => {
  it("subtracts break from shift duration", () => {
    // 8 hour shift, 30 min break = 7.5 expected
    expect(expectedHoursWorked("08:00", "16:00", 30)).toBe(7.5);
  });

  it("clamps to 0 if break exceeds shift", () => {
    expect(expectedHoursWorked("08:00", "09:00", 120)).toBe(0);
  });
});

describe("underTime", () => {
  it("returns 0 when worked hours exceed expected", () => {
    expect(underTime(8, "08:00", "16:00", 0)).toBe(0);
  });

  it("returns the difference when undertime", () => {
    // Expected 8, worked 7 → undertime 1
    expect(underTime(7, "08:00", "16:00", 0)).toBe(1);
  });

  it("returns 0 when exactly matching expected", () => {
    expect(underTime(7.5, "08:00", "16:00", 30)).toBe(0);
  });
});

describe("todayISODate", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("ABSENCE_TYPE_LABEL", () => {
  it("maps all absence types to Czech labels", () => {
    expect(ABSENCE_TYPE_LABEL.dovolena).toBe("Dovolená");
    expect(ABSENCE_TYPE_LABEL.nemoc).toBe("Nemoc");
    expect(ABSENCE_TYPE_LABEL.lekar).toBe("Lékař");
    expect(ABSENCE_TYPE_LABEL.neplacene_volno).toBe("Neplacené volno");
    expect(ABSENCE_TYPE_LABEL.jine).toBe("Jiné");
  });
});
