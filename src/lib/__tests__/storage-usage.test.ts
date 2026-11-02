import { describe, it, expect } from "vitest";
import { usageLevel } from "../storage-usage";

describe("usageLevel", () => {
  it("pod 80 % je v pořádku", () => expect(usageLevel(79)).toBe("ok"));
  it("od 80 % varuje", () => expect(usageLevel(80)).toBe("warn"));
  it("od 90 % je kritické", () => expect(usageLevel(90)).toBe("critical"));
});
