const ONES_F = [
  "nula",
  "jedna",
  "dvě",
  "tři",
  "čtyři",
  "pět",
  "šest",
  "sedm",
  "osm",
  "devět",
];
const ONES_M = [...ONES_F];
ONES_M[1] = "jeden";
ONES_M[2] = "dva";

const TEENS = [
  "deset",
  "jedenáct",
  "dvanáct",
  "třináct",
  "čtrnáct",
  "patnáct",
  "šestnáct",
  "sedmnáct",
  "osmnáct",
  "devatenáct",
];

const TENS = [
  "",
  "",
  "dvacet",
  "třicet",
  "čtyřicet",
  "padesát",
  "šedesát",
  "sedmdesát",
  "osmdesát",
  "devadesát",
];

const HUNDREDS = [
  "",
  "sto",
  "dvě stě",
  "tři sta",
  "čtyři sta",
  "pět set",
  "šest set",
  "sedm set",
  "osm set",
  "devět set",
];

/** 1–999 slovy; `masculine` ovlivňuje jedna/jeden a dvě/dva. */
function belowThousand(n: number, masculine: boolean): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) out.push(HUNDREDS[h]!);
  if (rest >= 10 && rest < 20) {
    out.push(TEENS[rest - 10]!);
  } else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t > 0) out.push(TENS[t]!);
    if (u > 0) out.push((masculine ? ONES_M : ONES_F)[u]!);
  }
  return out;
}

function unitForm(n: number, forms: [string, string, string]): string {
  if (n === 1) return forms[0];
  if (n >= 2 && n <= 4) return forms[1];
  return forms[2];
}

/** Celé číslo slovy česky (do miliard). */
export function cisloSlovy(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "nula";

  const parts: string[] = [];
  const groups: { div: number; forms: [string, string, string] }[] = [
    { div: 1_000_000_000, forms: ["miliarda", "miliardy", "miliard"] },
    { div: 1_000_000, forms: ["milion", "miliony", "milionů"] },
    { div: 1_000, forms: ["tisíc", "tisíce", "tisíc"] },
  ];

  let rest = n;
  for (const g of groups) {
    const count = Math.floor(rest / g.div);
    rest %= g.div;
    if (count === 0) continue;
    const feminine = g.div === 1_000_000_000; // miliarda je rodu ženského
    parts.push(...belowThousand(count, !feminine));
    parts.push(unitForm(count, g.forms));
  }
  if (rest > 0) parts.push(...belowThousand(rest, false));

  return parts.filter(Boolean).join(" ");
}

/** Např. 250000 → „dvě stě padesát tisíc korun českých“. */
export function korunySlovy(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const n = Math.floor(value);
  const currency = unitForm(n, ["koruna česká", "koruny české", "korun českých"]);
  return `${cisloSlovy(n)} ${currency}`;
}
