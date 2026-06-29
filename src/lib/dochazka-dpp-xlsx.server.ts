// Server-only helper: vygeneruje XLSX docházkový list pro DPP zaměstnance
// na základě nahraného šablonového souboru `DPP_duben_2026.xlsx`.
import ExcelJS from "exceljs";
import dppTemplateB64 from "@/assets/dpp-template.b64";

export type DppXlsxRow = {
  date: string; // YYYY-MM-DD
  check_in: string; // ISO UTC
  check_out: string; // ISO UTC
  break_duration: number; // minutes
  hours_worked: number;
};

function b64ToUint8Array(b64: string): Uint8Array {
  // atob je v Cloudflare/V8 dostupné
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utcHM(iso: string): { h: number; m: number } {
  const d = new Date(iso);
  return { h: d.getUTCHours(), m: d.getUTCMinutes() };
}

export async function buildDppXlsx(opts: {
  employeeName: string;
  year: number;
  month: number; // 1-12
  rows: DppXlsxRow[];
}): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const buf = b64ToUint8Array(dppTemplateB64);
  await wb.xlsx.load(buf.buffer as ArrayBuffer);
  const ws = wb.worksheets[0];

  // Hlavička: jméno, měsíc, rok
  ws.getCell("G3").value = `${opts.employeeName}  DPP`;
  ws.getCell("Y3").value = opts.month;
  ws.getCell("AA3").value = opts.year;

  // Pojmenuj list dle příjmení
  const surname = opts.employeeName.trim().split(/\s+/)[0] ?? "DPP";
  ws.name = surname.slice(0, 28);

  // Mapuj řádky podle dne v měsíci. Den 1 = řádek 10, den 31 = řádek 40.
  const byDay = new Map<number, DppXlsxRow>();
  for (const r of opts.rows) {
    const day = Number(r.date.slice(8, 10));
    if (day) byDay.set(day, r);
  }

  for (let day = 1; day <= 31; day++) {
    const row = 9 + day;
    const r = byDay.get(day);
    if (!r || r.hours_worked <= 0) continue;

    const inT = utcHM(r.check_in);
    const outT = utcHM(r.check_out);
    ws.getCell(`B${row}`).value = inT.h;
    ws.getCell(`C${row}`).value = inT.m;
    ws.getCell(`D${row}`).value = outT.h;
    ws.getCell(`E${row}`).value = outT.m;

    if (r.break_duration > 0) {
      // Pauza umístěná do středu směny
      const start = new Date(r.check_in).getTime();
      const end = new Date(r.check_out).getTime();
      const mid = start + (end - start - r.break_duration * 60_000) / 2;
      const breakStart = new Date(mid);
      const breakEnd = new Date(mid + r.break_duration * 60_000);
      ws.getCell(`F${row}`).value = breakStart.getUTCHours();
      ws.getCell(`G${row}`).value = breakStart.getUTCMinutes();
      ws.getCell(`H${row}`).value = breakEnd.getUTCHours();
      ws.getCell(`I${row}`).value = breakEnd.getUTCMinutes();
    }

    // Souhrnné hodiny/minuty (formule shodné se šablonou)
    ws.getCell(`S${row}`).value = { formula: `IF(AE${row}=0," ",INT(AE${row}))` } as any;
    ws.getCell(`T${row}`).value = { formula: `IF(AE${row}=0," ",60*(AE${row}-INT(AE${row})))` } as any;
  }

  const out = await wb.xlsx.writeBuffer();
  return new Uint8Array(out as ArrayBuffer);
}

export function uint8ToBase64(u8: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(bin);
}