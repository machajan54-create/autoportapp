export const ABSENCE_TYPES = [
  { value: "dovolena", label: "Dovolená" },
  { value: "nemoc", label: "Nemoc" },
  { value: "lekar", label: "Lékař" },
  { value: "neplacene_volno", label: "Neplacené volno" },
  { value: "jine", label: "Jiné" },
] as const;

export type AbsenceTypeValue = (typeof ABSENCE_TYPES)[number]["value"];

export const ABSENCE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ABSENCE_TYPES.map((t) => [t.value, t.label]),
);

export const SHIFT_COLORS = [
  { value: "amber", label: "Žlutá", className: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: "sky", label: "Modrá", className: "bg-sky-100 text-sky-800 border-sky-300" },
  { value: "purple", label: "Fialová", className: "bg-purple-100 text-purple-800 border-purple-300" },
  { value: "emerald", label: "Zelená", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: "rose", label: "Růžová", className: "bg-rose-100 text-rose-800 border-rose-300" },
] as const;

export const AVATAR_COLORS = ["slate", "blue", "purple", "emerald", "amber", "rose"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export function avatarClasses(color: string | null | undefined): string {
  switch (color) {
    case "blue": return "bg-blue-100 text-blue-700 border-blue-300";
    case "purple": return "bg-purple-100 text-purple-700 border-purple-300";
    case "emerald": return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "amber": return "bg-amber-100 text-amber-700 border-amber-300";
    case "rose": return "bg-rose-100 text-rose-700 border-rose-300";
    default: return "bg-slate-100 text-slate-800 border-slate-300";
  }
}

export function shiftClasses(color: string | null | undefined): string {
  const found = SHIFT_COLORS.find((c) => c.value === color);
  return found?.className ?? "bg-slate-100 text-slate-800 border-slate-300";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("cs-CZ");
}

export function formatHours(h: number | null | undefined): string {
  if (h == null || Number.isNaN(h)) return "—";
  const whole = Math.floor(h);
  const minutes = Math.round((h - whole) * 60);
  return `${whole}h ${minutes}m`;
}

export function calculateHoursWorked(checkInIso: string, checkOutIso: string, breakMinutes: number): number {
  const start = new Date(checkInIso).getTime();
  const end = new Date(checkOutIso).getTime();
  if (end <= start) return 0;
  const diffMs = end - start;
  const breakMs = breakMinutes * 60 * 1000;
  const netMs = Math.max(0, diffMs - breakMs);
  return Math.round((netMs / (1000 * 60 * 60)) * 100) / 100;
}

export function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}