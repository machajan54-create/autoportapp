// Odhadovaný limit místa pro databázi (velikost disku databáze). Při zvětšení disku upravte.
export const DB_LIMIT_BYTES = 1.5 * 1024 ** 3;
export const WARN_PCT = 80;
export const CRITICAL_PCT = 90;

export type UsageLevel = "ok" | "warn" | "critical";

export function usageLevel(pct: number): UsageLevel {
  if (pct >= CRITICAL_PCT) return "critical";
  if (pct >= WARN_PCT) return "warn";
  return "ok";
}

export function formatBytes(b: number): string {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  return `${Math.round(b / 1024 ** 2)} MB`;
}
