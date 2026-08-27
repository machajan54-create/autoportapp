import { describe, it, expect } from "vitest";
import {
  DEFECT_PRIORITY,
  DEFECT_STATUS,
  DEFECT_PRIORITY_LABEL,
  DEFECT_STATUS_LABEL,
} from "@/lib/defects.functions";

describe("DEFECT_PRIORITY", () => {
  it("has 4 levels from low to critical", () => {
    expect(DEFECT_PRIORITY).toEqual(["low", "medium", "high", "critical"]);
  });
});

describe("DEFECT_STATUS", () => {
  it("has 4 statuses in lifecycle order", () => {
    expect(DEFECT_STATUS).toEqual(["new", "in_progress", "resolved", "closed"]);
  });
});

describe("DEFECT_PRIORITY_LABEL", () => {
  it("has Czech labels for all priorities", () => {
    expect(DEFECT_PRIORITY_LABEL.low).toBe("Nízká");
    expect(DEFECT_PRIORITY_LABEL.medium).toBe("Střední");
    expect(DEFECT_PRIORITY_LABEL.high).toBe("Vysoká");
    expect(DEFECT_PRIORITY_LABEL.critical).toBe("Kritická");
  });

  it("has a label for every priority", () => {
    for (const p of DEFECT_PRIORITY) {
      expect(DEFECT_PRIORITY_LABEL[p]).toBeTruthy();
    }
  });
});

describe("DEFECT_STATUS_LABEL", () => {
  it("has Czech labels for all statuses", () => {
    expect(DEFECT_STATUS_LABEL.new).toBe("Nová");
    expect(DEFECT_STATUS_LABEL.in_progress).toBe("V řešení");
    expect(DEFECT_STATUS_LABEL.resolved).toBe("Vyřešeno");
    expect(DEFECT_STATUS_LABEL.closed).toBe("Uzavřeno");
  });

  it("has a label for every status", () => {
    for (const s of DEFECT_STATUS) {
      expect(DEFECT_STATUS_LABEL[s]).toBeTruthy();
    }
  });
});
