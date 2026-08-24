import { describe, it, expect } from "vitest";
import {
  computeNextDueDate,
  TASK_RECURRENCE_LABEL,
  TASK_STATUS_LABEL,
  TASK_PRIORITY_LABEL,
} from "@/lib/tasks.functions";

describe("TASK_RECURRENCE_LABEL", () => {
  it("has Czech labels for all recurrence types", () => {
    expect(TASK_RECURRENCE_LABEL.daily).toBe("Každý den");
    expect(TASK_RECURRENCE_LABEL.weekdays).toBe("Každý pracovní den");
    expect(TASK_RECURRENCE_LABEL.weekly).toBe("Každý týden");
  });
});

describe("TASK_STATUS_LABEL", () => {
  it("has Czech labels for all statuses", () => {
    expect(TASK_STATUS_LABEL.todo).toBe("K udělání");
    expect(TASK_STATUS_LABEL.in_progress).toBe("V řešení");
    expect(TASK_STATUS_LABEL.done).toBe("Hotovo");
  });
});

describe("TASK_PRIORITY_LABEL", () => {
  it("has Czech labels for all priorities", () => {
    expect(TASK_PRIORITY_LABEL.low).toBe("Nízká");
    expect(TASK_PRIORITY_LABEL.medium).toBe("Střední");
    expect(TASK_PRIORITY_LABEL.high).toBe("Vysoká");
  });
});

describe("computeNextDueDate", () => {
  it("adds one day for daily recurrence", () => {
    expect(computeNextDueDate("2025-06-15", "daily")).toBe("2025-06-16");
  });

  it("handles month boundary for daily recurrence", () => {
    expect(computeNextDueDate("2025-06-30", "daily")).toBe("2025-07-01");
  });

  it("handles year boundary for daily recurrence", () => {
    expect(computeNextDueDate("2025-12-31", "daily")).toBe("2026-01-01");
  });

  it("adds seven days for weekly recurrence", () => {
    expect(computeNextDueDate("2025-06-15", "weekly")).toBe("2025-06-22");
  });

  it("skips weekend for weekdays recurrence from Friday", () => {
    // 2025-06-13 is a Friday → next weekday is Monday 2025-06-16
    expect(computeNextDueDate("2025-06-13", "weekdays")).toBe("2025-06-16");
  });

  it("skips weekend for weekdays recurrence from Saturday", () => {
    // 2025-06-14 is a Saturday → next weekday is Monday 2025-06-16
    expect(computeNextDueDate("2025-06-14", "weekdays")).toBe("2025-06-16");
  });

  it("goes to next day for weekdays recurrence from Monday", () => {
    // 2025-06-16 is a Monday → next is Tuesday 2025-06-17
    expect(computeNextDueDate("2025-06-16", "weekdays")).toBe("2025-06-17");
  });

  it("uses current date when baseDate is null", () => {
    const result = computeNextDueDate(null, "daily");
    const today = new Date();
    today.setUTCDate(today.getUTCDate() + 1);
    const expected = today.toISOString().slice(0, 10);
    expect(result).toBe(expected);
  });
});
