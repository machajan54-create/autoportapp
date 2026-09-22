import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import robotoRegularB64 from "@/assets/fonts/Roboto-Regular.ttf.base64";
import robotoBoldB64 from "@/assets/fonts/Roboto-Bold.ttf.base64";

function fmtKc(n: number | null | undefined): string {
  if (n == null) return "…………………………";
  return new Intl.NumberFormat("cs-CZ").format(Number(n)) + " Kč";
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return "…………………";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("cs-CZ");
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const DOTS = "...................................................";

const overridesSchema = z
  .object({
    seller_name: z.string(),
    seller_ico: z.string(),
    seller_address: z.string(),
    seller_id_doc: z.string(),
    seller_contact: z.string(),
    seller_bank: z.string(),
    vehicle_name: z.string(),
    rok_vyroby: z.string(),
    vin: z.string(),
    spz: z.string(),
    tp: z.string(),
    barva: z.string(),
    palivo: z.string(),
    first_registration: z.string(),
    km: z.string(),
    keys: z.string(),
    price: z.string(),
    price_words: z.string(),
    payment_account: z.string(),
    payment_due: z.string(),
    defects: z.string(),
    place: z.string(),
    contract_date: z.string(),
  })
  .partial();

export type VykupContractOverrides = z.infer<typeof overridesSchema>;

/** Returns a base64-encoded PDF of the kupní smlouva na ojeté motorové vozidlo. */
export const generateVykupContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        vykupId: z.string().uuid(),
        overrides: overridesSchema.optional(),
        mode: z.enum(["full", "poa"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: v, error } = await context.supabase
      .from("vykupy")
      .select("*")
      .eq("id", data.vykupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!v) throw new Error("Výkup nenalezen");

    const o = data.overrides ?? {};
    const ov = (key: keyof VykupContractOverrides, fallback?: string | null) => {
      const val = o[key];
      if (val != null && String(val).trim()) return String(val).trim();
      return fallback && String(fallback).trim() ? String(fallback).trim() : null;
    };


    const { PDFDocument, rgb } = await import("pdf-lib");
    const fontkit = (await import("@pdf-lib/fontkit")).default;
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    pdf.setTitle(`Kupní smlouva ${v.znacka ?? ""} ${v.model ?? ""}`.trim());
    pdf.setProducer("AutoPort");
    pdf.setCreator("AutoPort");

    const [font, fontB] = await Promise.all([
      pdf.embedFont(b64ToBytes(robotoRegularB64), { subset: true }),
      pdf.embedFont(b64ToBytes(robotoBoldB64), { subset: true }),
    ]);

    const A4: [number, number] = [595.28, 841.89];
    const marginX = 56;
    const topY = 800;
    const bottomY = 60;
    const contentW = A4[0] - marginX * 2;
    const black = rgb(0.1, 0.1, 0.1);
    const gray = rgb(0.42, 0.42, 0.42);
    const accent = rgb(0.96, 0.45, 0.05);

    let page = pdf.addPage(A4);
    let y = topY;

    const newPage = () => {
      page = pdf.addPage(A4);
      y = topY;
    };
    const ensure = (needed: number) => {
      if (y - needed < bottomY) newPage();
    };

    const widthOf = (t: string, size: number, bold = false) =>
      (bold ? fontB : font).widthOfTextAtSize(t, size);

    const drawAt = (
      text: string,
      x: number,
      yy: number,
      opts: { size?: number; bold?: boolean; color?: any } = {},
    ) => {
      page.drawText(text, {
        x,
        y: yy,
        size: opts.size ?? 9.5,
        font: opts.bold ? fontB : font,
        color: opts.color ?? black,
      });
    };

    const wrap = (text: string, size: number, maxW: number, bold = false): string[] => {
      const out: string[] = [];
      for (const rawLine of String(text).split(/\n/)) {
        const words = rawLine.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
          out.push("");
          continue;
        }
        let line = "";
        for (const w of words) {
          const next = line ? `${line} ${w}` : w;
          if (widthOf(next, size, bold) > maxW && line) {
            out.push(line);
            line = w;
          } else {
            line = next;
          }
        }
        if (line) out.push(line);
      }
      return out;
    };

    const para = (
      text: string,
      opts: { size?: number; bold?: boolean; indent?: number; gap?: number; color?: any } = {},
    ) => {
      const size = opts.size ?? 9.5;
      const indent = opts.indent ?? 0;
      const lines = wrap(text, size, contentW - indent, opts.bold);
      const lh = size + 3.5;
      for (const line of lines) {
        ensure(lh);
        drawAt(line, marginX + indent, y, { size, bold: opts.bold, color: opts.color });
        y -= lh;
      }
      y -= opts.gap ?? 4;
    };

    const heading = (text: string) => {
      ensure(34);
      y -= 6;
      drawAt(text, marginX, y, { size: 11, bold: true, color: accent });
      y -= 5;
      page.drawLine({
        start: { x: marginX, y },
        end: { x: A4[0] - marginX, y },
        thickness: 0.6,
        color: accent,
      });
      y -= 14;
    };

    /** Label with a value or a dotted fill-in line. */
    const field = (label: string, value?: string | null) => {
      const size = 9.5;
      ensure(15);
      drawAt(label, marginX, y, { size, color: gray });
      const x = marginX + Math.max(190, widthOf(label, size) + 10);
      const val = value && String(value).trim() ? String(value).trim() : DOTS;
      drawAt(val, x, y, { size, bold: Boolean(value && String(value).trim()) });
      y -= 15;
    };

    const poaOnly = data.mode === "poa";
    const colW = 200;

    // ---- Title -------------------------------------------------------------
    if (!poaOnly) {
    page.drawRectangle({ x: 0, y: A4[1] - 36, width: A4[0], height: 36, color: accent });
    drawAt("AUTOPORT, s.r.o.", marginX, A4[1] - 24, { size: 12, bold: true, color: rgb(1, 1, 1) });
    drawAt(`Č. ${v.id.slice(0, 8).toUpperCase()}`, A4[0] - marginX - 90, A4[1] - 24, {
      size: 10,
      bold: true,
      color: rgb(1, 1, 1),
    });

    y = A4[1] - 74;
    const title = "KUPNÍ SMLOUVA";
    drawAt(title, (A4[0] - widthOf(title, 18, true)) / 2, y, { size: 18, bold: true });
    y -= 18;
    const sub = "na ojeté motorové vozidlo";
    drawAt(sub, (A4[0] - widthOf(sub, 11)) / 2, y, { size: 11, color: gray });
    y -= 16;
    const law = "uzavřená podle § 2079 a násl. zákona č. 89/2012 Sb., občanský zákoník, v platném znění";
    drawAt(law, (A4[0] - widthOf(law, 8.5)) / 2, y, { size: 8.5, color: gray });
    y -= 22;

    // ---- Smluvní strany ----------------------------------------------------
    heading("Smluvní strany");
    para("1. Prodávající", { bold: true, size: 10, gap: 6 });
    field("Jméno a příjmení / obchodní firma:", ov("seller_name", v.klient));
    field("Rodné číslo / IČO:", ov("seller_ico"));
    field("Bydliště / sídlo:", ov("seller_address"));
    field("Číslo OP / zapsán v OR u:", ov("seller_id_doc"));
    field("Telefon / e-mail:", ov("seller_contact", v.telefon));
    field("Bankovní spojení (číslo účtu):", ov("seller_bank"));

    para("(dále jen „Prodávající“)", { size: 8.5, color: gray, gap: 8 });

    para("2. Kupující", { bold: true, size: 10, gap: 6 });
    field("Obchodní firma:", "AUTOPORT, s.r.o.");
    field("IČO:", "49614703");
    field("DIČ:", "CZ49614703");
    field("Sídlo:", "Korytná 47/3, Strašnice, 100 00 Praha 10");
    field("Zapsaná v OR vedeném:", "Městským soudem v Praze");
    field("Zastoupená:", "Patrikem Hrubým, jednatel");
    para("(dále jen „Kupující“)", { size: 8.5, color: gray, gap: 6 });
    para(
      "(Prodávající a Kupující dále společně také jako „Smluvní strany“ a jednotlivě jako „Smluvní strana“)",
      { size: 8.5, color: gray, gap: 8 },
    );

    // ---- Článek I ----------------------------------------------------------
    heading("Článek I. Předmět smlouvy");
    para(
      "1.1  Prodávající prohlašuje, že je výlučným vlastníkem níže specifikovaného motorového vozidla (dále jen „Vozidlo“) a že je oprávněn s Vozidlem volně nakládat.",
    );
    para(
      "1.2  Prodávající touto smlouvou prodává Vozidlo Kupujícímu a zavazuje se mu jej odevzdat, a Kupující Vozidlo kupuje a zavazuje se zaplatit Prodávajícímu sjednanou kupní cenu.",
    );
    para("1.3  Kupující kupuje Vozidlo v rámci své podnikatelské činnosti, zejména za účelem jeho dalšího prodeje.", {
      gap: 8,
    });

    para("Specifikace vozidla", { bold: true, size: 10, gap: 6 });
    field(
      "Tovární značka a model:",
      ov("vehicle_name", [v.znacka, v.model].filter(Boolean).join(" ")),
    );
    field("Rok výroby:", ov("rok_vyroby", v.rok_vyroby ? String(v.rok_vyroby) : null));
    field("VIN (identifikační číslo vozidla):", ov("vin"));
    field("Registrační značka (SPZ):", ov("spz"));
    field("Číslo technického průkazu:", ov("tp"));
    field("Barva:", ov("barva", v.barva));
    field("Palivo / objem a výkon motoru:", ov("palivo"));
    field("Datum první registrace:", ov("first_registration"));
    field(
      "Stav tachometru (najeté km) ke dni předání:",
      ov("km", v.pocet_km != null ? `${new Intl.NumberFormat("cs-CZ").format(v.pocet_km)} km` : null),
    );
    field("Počet klíčů předaných Kupujícímu:", ov("keys"));

    y -= 4;

    // ---- Článek II ---------------------------------------------------------
    heading("Článek II. Kupní cena a platební podmínky");
    const priceText = (() => {
      const raw = ov("price");
      if (raw) {
        const num = Number(raw.replace(/[^\d.,-]/g, "").replace(/\s/g, "").replace(",", "."));
        return Number.isFinite(num) && num > 0 ? fmtKc(num) : raw;
      }
      return fmtKc(v.vykoupeno_za);
    })();
    para(
      `2.1  Kupní cena Vozidla byla Smluvními stranami dohodou sjednána ve výši ${priceText} (slovy: ${ov("price_words") ?? DOTS}). Cena je uvedena včetně DPH.`,
    );
    para(
      `2.2  Kupní cena bude uhrazena [ ] v hotovosti při předání Vozidla   [ ] bezhotovostním převodem na účet Prodávajícího č. ${ov("payment_account") ?? DOTS}, a to nejpozději do ${ov("payment_due") ?? "…………………"} ode dne podpisu této smlouvy, vždy však před předáním Vozidla Kupujícímu.`,
    );

    para(
      "2.3  Prodávající svým podpisem potvrzuje přijetí kupní ceny, případně vystaví Kupujícímu doklad o zaplacení (příjmový doklad / fakturu).",
      { gap: 8 },
    );

    // ---- Článek III --------------------------------------------------------
    heading("Článek III. Předání vozidla a nabytí vlastnictví");
    para(
      "3.1  Prodávající předá Kupujícímu Vozidlo, jeho příslušenství, klíče a dále veškeré doklady náležející k Vozidlu (zejména technický průkaz, osvědčení o registraci vozidla, servisní knihu, doklad o platné technické prohlídce), a to až po úplném zaplacení kupní ceny dle čl. II této smlouvy, nedohodnou-li se Smluvní strany písemně jinak.",
    );
    para("3.2  O předání a převzetí Vozidla sepíší Smluvní strany předávací protokol.");
    para(
      "3.3  Vlastnické právo k Vozidlu i nebezpečí škody na Vozidle přechází na Kupujícího okamžikem předání Vozidla.",
    );
    para(
      "3.4  Kupující je povinen bez zbytečného odkladu po nabytí vlastnického práva zajistit přepis Vozidla na příslušném registru vozidel.",
    );
    para(
      "3.5  Prodávající se zavazuje poskytnout Kupujícímu veškerou součinnost potřebnou k přepisu Vozidla na příslušném úřadu, včetně případné osobní účasti, vyžaduje-li to platná právní úprava.",
      { gap: 8 },
    );

    // ---- Článek IV ---------------------------------------------------------
    heading("Článek IV. Prohlášení a záruky prodávajícího");
    para(
      "4.1  Prodávající prohlašuje, že na Vozidle neváznou žádná práva třetích osob (zejména zástavní právo, věcné břemeno, výhrada vlastnického práva, leasing), že Vozidlo není předmětem exekučního ani insolvenčního řízení a že nejsou dány žádné právní vady bránící převodu vlastnického práva.",
    );
    para(
      "4.2  Prodávající prohlašuje, že Vozidlo nebylo odcizeno, není a nebylo vedeno v evidenci odcizených vozidel a není předmětem trestního řízení.",
    );
    para(
      "4.3  Prodávající prohlašuje, že Kupujícímu sdělil veškeré vady, škodní a nehodové události Vozidla, které mu jsou známy, a to včetně poškození nosné konstrukce (rámu, karoserie), pokud k němu došlo. Takto sdělené skutečnosti jsou uvedeny níže; neuvede-li Prodávající žádnou skutečnost, prohlašuje tím, že mu žádná vada ani škodní či nehodová událost není známa.",
    );
    para("Prodávajícímu známé vady / škodní či nehodová historie Vozidla:", {
      bold: true,
      size: 9.5,
      gap: 4,
    });
    // poznámka z DB je interní — do smlouvy se nikdy nepromítá
    const internalNote = (v as { poznamka?: string | null }).poznamka?.trim() ?? "";
    const rawDefects = ov("defects");
    const defectsText =
      rawDefects && internalNote && rawDefects.trim() === internalNote ? null : rawDefects;
    if (defectsText) {
      para(defectsText, { gap: 6 });
    } else {
      para(`${DOTS}${DOTS}`, { gap: 6 });
      para(`${DOTS}${DOTS}`, { gap: 6 });
    }

    para(
      "4.4  Prodávající prohlašuje, že údaj o stavu tachometru uvedený v čl. I této smlouvy odpovídá skutečnému počtu ujetých kilometrů, pokud je mu známo, a že s tímto stavem nebylo manipulováno.",
    );
    para(
      "4.5  Prodávající prohlašuje, že veškeré údaje o Vozidle uvedené v čl. I této smlouvy jsou pravdivé a úplné a že VIN uvedený v této smlouvě odpovídá VIN vyznačenému na Vozidle i v technickém průkazu.",
      { gap: 8 },
    );

    // ---- Článek V ----------------------------------------------------------
    heading("Článek V. Odpovědnost za vady");
    para(
      "5.1  Kupující prohlašuje, že se před podpisem této smlouvy s Vozidlem seznámil, prohlédl si je a seznámil se s jeho technickým stavem, jak byl Prodávajícím popsán a jak vyplývá z běžné vizuální prohlídky.",
    );
    para(
      "5.2  Ustanovením odst. 5.1 nejsou dotčena práva Kupujícího z vad, které nebyly při běžné prohlídce zjistitelné (skryté vady), ani nároky Kupujícího vyplývající z nepravdivosti či neúplnosti prohlášení Prodávajícího dle čl. IV této smlouvy.",
    );
    para(
      "5.3  Práva z vadného plnění se řídí příslušnými ustanoveními občanského zákoníku, nedohodnou-li se Smluvní strany v konkrétním případě jinak.",
      { gap: 8 },
    );

    // ---- Článek VI ---------------------------------------------------------
    heading("Článek VI. Náhrada škody a odstoupení od smlouvy");
    para(
      "6.1  Prokáže-li se, že kterékoli z prohlášení Prodávajícího uvedených v čl. IV této smlouvy je nepravdivé nebo neúplné, je Prodávající povinen nahradit Kupujícímu veškerou škodu tím vzniklou, a to v plné výši.",
    );
    para(
      "6.2  Vyjde-li najevo, že na Vozidle vázne právo třetí osoby, že je Vozidlo vedeno jako odcizené, nebo že je předmětem exekučního či insolvenčního řízení, je Kupující oprávněn od této smlouvy odstoupit, a to i po převzetí Vozidla, písemným oznámením doručeným Prodávajícímu. V takovém případě je Prodávající povinen vrátit Kupujícímu zaplacenou kupní cenu v plné výši do 10 dnů od doručení odstoupení; tím není dotčen nárok Kupujícího na náhradu škody dle odst. 6.1.",
      { gap: 8 },
    );

    // ---- Článek VII --------------------------------------------------------
    heading("Článek VII. Závěrečná ustanovení");
    para("7.1  Tato smlouva nabývá platnosti a účinnosti dnem jejího podpisu oběma Smluvními stranami.");
    para(
      "7.2  Právní vztahy touto smlouvou výslovně neupravené se řídí příslušnými ustanoveními zákona č. 89/2012 Sb., občanský zákoník, v platném znění.",
    );
    para(
      "7.3  Tuto smlouvu lze měnit nebo doplňovat pouze formou písemných, vzestupně číslovaných dodatků podepsaných oběma Smluvními stranami.",
    );
    para(
      "7.4  Smlouva je vyhotovena ve dvou stejnopisech s platností originálu, přičemž každá ze Smluvních stran obdrží po jednom vyhotovení.",
    );
    para(
      "7.5  Smluvní strany prohlašují, že si tuto smlouvu před jejím podpisem přečetly, že s jejím obsahem souhlasí a že tato smlouva byla sepsána na základě jejich pravé a svobodné vůle, nikoli v tísni ani za nápadně nevýhodných podmínek, na důkaz čehož připojují své podpisy.",
      { gap: 10 },
    );


    ensure(90);
    para(
      `V ${ov("place") ?? "...................................."} dne ${fmtDate(ov("contract_date", v.datum_vykupu) ?? new Date().toISOString())}`,
      { gap: 30 },

    );

    // ---- Podpisy -----------------------------------------------------------
    ensure(70);
    const rightX = A4[0] - marginX - colW;
    page.drawLine({ start: { x: marginX, y }, end: { x: marginX + colW, y }, thickness: 0.6 });
    page.drawLine({ start: { x: rightX, y }, end: { x: rightX + colW, y }, thickness: 0.6 });
    drawAt("Prodávající", marginX, y - 13, { size: 9, bold: true });
    drawAt("Kupující", rightX, y - 13, { size: 9, bold: true });
    drawAt("AUTOPORT, s.r.o.", rightX, y - 25, { size: 8.5, color: gray });
    drawAt("Patrik Hrubý, jednatel", rightX, y - 36, { size: 8.5, color: gray });

    // ---- Zápatí smlouvy ----------------------------------------------------
    const contractPages = pdf.getPages();
    contractPages.forEach((p, i) => {
      p.drawText(`AUTOPORT, s.r.o. — kupní smlouva na ojeté motorové vozidlo`, {
        x: marginX,
        y: 32,
        size: 7.5,
        font,
        color: gray,
      });
      const label = `Strana ${i + 1} / ${contractPages.length}`;
      p.drawText(label, {
        x: A4[0] - marginX - font.widthOfTextAtSize(label, 7.5),
        y: 32,
        size: 7.5,
        font,
        color: gray,
      });
    });
    }

    // ---- PLNÁ MOC (jen samostatně) -----------------------------------------
    if (poaOnly) {
    page.drawRectangle({ x: 0, y: A4[1] - 36, width: A4[0], height: 36, color: accent });
    drawAt("AUTOPORT, s.r.o.", marginX, A4[1] - 24, { size: 12, bold: true, color: rgb(1, 1, 1) });
    drawAt("Plná moc", A4[0] - marginX - 130, A4[1] - 24, {
      size: 10,
      bold: true,
      color: rgb(1, 1, 1),
    });

    y = A4[1] - 100;
    const pmTitle = "PLNÁ MOC";
    drawAt(pmTitle, (A4[0] - widthOf(pmTitle, 18, true)) / 2, y, { size: 18, bold: true });
    y -= 34;

    const sellerName = ov("seller_name", v.klient) ?? DOTS;
    para(sellerName, {
      size: 10,
      gap: 14,
    });
    para("uděluje tímto plnou moc", { size: 10, bold: true, gap: 16 });
    para(`${DOTS}${DOTS}`, { gap: 4 });
    para("(jméno, příjmení, rodné číslo / datum narození a bydliště zmocněnce)", {
      size: 8.5,
      color: gray,
      gap: 16,
    });
    para(
      "k zastupování při jednání s Magistrátem hl. m. Prahy ve věci evidence motorových vozidel, a to zejména k těmto úkonům:",
      { size: 10, gap: 10 },
    );
    for (const item of [
      "k přihlášení vozidla",
      "k převodu vozidla",
      "k odhlášení vozidla",
      "k dohlášení vozidla",
      "ke zplnomocnění další „třetí osoby“ pro shora uvedená jednání",
    ]) {
      para(`•  ${item}`, { size: 10, indent: 14, gap: 2 });
    }
    y -= 14;

    field(
      "Tovární značka a model:",
      ov("vehicle_name", [v.znacka, v.model].filter(Boolean).join(" ")),
    );
    field("VIN:", ov("vin"));
    field("RZ:", ov("spz"));

    y -= 26;
    para(
      `V Praze dne ${fmtDate(ov("contract_date", v.datum_vykupu) ?? new Date().toISOString())}`,
      { size: 10, gap: 56 },
    );

    page.drawLine({ start: { x: marginX, y }, end: { x: marginX + colW, y }, thickness: 0.6 });
    drawAt(sellerName, marginX, y - 13, { size: 9, bold: true });

    page.drawText("AUTOPORT, s.r.o. — plná moc", {
      x: marginX,
      y: 32,
      size: 7.5,
      font,
      color: gray,
    });
    }


    const bytes = await pdf.save();
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(bin);
    const slug = (s: string) =>
      s
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    const safeName = `${poaOnly ? "plna-moc" : "kupni-smlouva"}-${slug(v.znacka ?? "")}-${slug(v.model ?? "")}-${v.id.slice(0, 8)}.pdf`
      .replace(/-+/g, "-")
      .replace(/-\./g, ".");
    return { base64, file_name: safeName };
  });
