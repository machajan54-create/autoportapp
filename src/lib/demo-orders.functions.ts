import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function logEvent(args: {
  orderId: string;
  type: string;
  message: string;
  actorId: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let actorName: string | null = null;
    if (args.actorId) {
      const { data: p } = await supabaseAdmin
        .from("profiles" as never)
        .select("full_name,email")
        .eq("id", args.actorId)
        .maybeSingle();
      actorName = (p as any)?.full_name || (p as any)?.email || null;
    }
    await supabaseAdmin.from("demo_order_events" as never).insert({
      order_id: args.orderId,
      type: args.type,
      message: args.message,
      actor_id: args.actorId,
      actor_name: actorName,
      meta: args.meta ?? null,
    } as never);
  } catch {
    // events log is best-effort
  }
}

async function isAdminUser(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: any) => r.role === "admin");
}

const lineItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  category: z.enum(["vehicle", "equipment", "package", "discount", "vip", "other"]).default("equipment"),
  bez_dph: z.number().default(0),
  dph_pct: z.number().min(0).max(100).default(21),
});

const orderInput = z.object({
  client_id: z.string().uuid(),
  model_verze: z.string().trim().max(200).optional().nullable(),
  vin: z.string().trim().max(40).optional().nullable(),
  rz: z.string().trim().max(20).optional().nullable(),
  barva: z.string().trim().max(80).optional().nullable(),
  najete_km: z.number().int().min(0).max(2_000_000).optional().nullable(),
  rok_vyroby: z.number().int().min(1990).max(2100).optional().nullable(),
  zaruka_spustena_od: z.string().trim().max(40).optional().nullable(),
  registrace_datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  datum_objednavky: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  datum_dodani: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  line_items: z.array(lineItemSchema).max(50).default([]),
  zaloha: z.number().min(0).default(0),
  notes: z.string().trim().max(4000).optional().nullable(),
});

function calcTotals(items: Array<z.infer<typeof lineItemSchema>>) {
  let bez = 0;
  let s = 0;
  for (const it of items) {
    bez += Number(it.bez_dph || 0);
    s += Number(it.bez_dph || 0) * (1 + Number(it.dph_pct || 0) / 100);
  }
  return {
    cena_celkem_bez_dph: Math.round(bez * 100) / 100,
    cena_celkem_s_dph: Math.round(s * 100) / 100,
  };
}

export const listDemoOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("demo_orders" as never)
      .select("id,order_number,invoice_number,status,model_verze,vin,rz,cena_celkem_s_dph,datum_objednavky,created_at,client_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const clientIds = Array.from(new Set(rows.map((r) => r.client_id).filter(Boolean)));
    let clients: Record<string, any> = {};
    if (clientIds.length) {
      const { data: cs } = await context.supabase
        .from("clients" as never)
        .select("id,full_name,company,email")
        .in("id", clientIds);
      clients = Object.fromEntries(((cs ?? []) as any[]).map((c) => [c.id, c]));
    }
    return { rows: rows.map((r) => ({ ...r, client: clients[r.client_id] || null })) };
  });

export const getDemoOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("demo_orders" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Objednávka nenalezena");
    const { data: client } = await context.supabase
      .from("clients" as never)
      .select("*")
      .eq("id", (order as any).client_id)
      .maybeSingle();
    const { data: docs } = await context.supabase
      .from("demo_order_documents" as never)
      .select("*")
      .eq("order_id", data.id)
      .order("created_at", { ascending: false });
    const { data: sigs } = await context.supabase
      .from("demo_order_signatures" as never)
      .select("id,mode,signer_name,signed_at,consumed_at,token,token_expires_at,created_at")
      .eq("order_id", data.id)
      .order("created_at", { ascending: false });
    const { data: events } = await context.supabase
      .from("demo_order_events" as never)
      .select("id,type,message,actor_id,actor_name,meta,created_at")
      .eq("order_id", data.id)
      .order("created_at", { ascending: false })
      .limit(200);
    return {
      order: order as any,
      client: client as any,
      documents: (docs ?? []) as any[],
      signatures: (sigs ?? []) as any[],
      events: (events ?? []) as any[],
    };
  });

export const createDemoOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderInput.parse(d))
  .handler(async ({ data, context }) => {
    const totals = calcTotals(data.line_items);
    const { data: row, error } = await context.supabase
      .from("demo_orders" as never)
      .insert({
        client_id: data.client_id,
        model_verze: data.model_verze ?? null,
        vin: data.vin ?? null,
        rz: data.rz ?? null,
        barva: data.barva ?? null,
        najete_km: data.najete_km ?? null,
        rok_vyroby: data.rok_vyroby ?? null,
        zaruka_spustena_od: data.zaruka_spustena_od ?? null,
        registrace_datum: data.registrace_datum ?? null,
        datum_objednavky: data.datum_objednavky ?? new Date().toISOString().slice(0, 10),
        datum_dodani: data.datum_dodani ?? null,
        line_items: data.line_items,
        zaloha: data.zaloha,
        ...totals,
        notes: data.notes ?? null,
        created_by: context.userId,
        status: "draft",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id as string };
  });

export const updateDemoOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderInput.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data as any;
    // Lock editing once signature flow has started, except for super admin.
    const { data: cur } = await context.supabase
      .from("demo_orders" as never)
      .select("status")
      .eq("id", id)
      .maybeSingle();
    const curStatus = (cur as any)?.status as string | undefined;
    if (curStatus && curStatus !== "draft") {
      const admin = await isAdminUser(context.supabase, context.userId);
      if (!admin) {
        throw new Error(
          "Objednávka už byla odeslána / podepsána. Úpravy může provést pouze super admin po schválené žádosti.",
        );
      }
    }
    const patch: Record<string, unknown> = { ...rest };
    if (Array.isArray(rest.line_items)) {
      const totals = calcTotals(rest.line_items);
      Object.assign(patch, totals);
    }
    const { error } = await context.supabase
      .from("demo_orders" as never)
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    if (curStatus && curStatus !== "draft") {
      await logEvent({
        orderId: id,
        type: "edited_after_lock",
        message: "Super admin upravil objednávku po uzamčení.",
        actorId: context.userId,
      });
    }
    return { ok: true };
  });

export const deleteDemoOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

// ============= PDF helpers =============

function sanitize(s: string): string {
  // With Unicode fonts (Roboto) embedded we keep diacritics; just strip control chars.
  return (s ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
}

function fmtKc(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("cs-CZ").format(Number(n)) + " Kč";
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("cs-CZ");
}

// Signature box coords (used by both order PDF and signed embed)
const SIG = {
  sellerX: 48, sellerY: 90, sellerW: 220, sellerH: 70,
  buyerX: 595.28 - 48 - 220, buyerY: 90, buyerW: 220, buyerH: 70,
  labelY: 80, lineY: 88,
};

const BRAND = {
  primary: [0.93, 0.36, 0.04] as [number, number, number], // sytější oranžová
  primarySoft: [1.0, 0.93, 0.85] as [number, number, number],
  dark: [0.07, 0.10, 0.15] as [number, number, number],
  ink: [0.10, 0.13, 0.18] as [number, number, number],
  muted: [0.42, 0.46, 0.52] as [number, number, number],
  hairline: [0.90, 0.92, 0.94] as [number, number, number],
  panel: [0.97, 0.97, 0.98] as [number, number, number],
  panelStrong: [1, 0.93, 0.78] as [number, number, number],
};

// ============= Unicode font loader (Roboto, supports Czech) =============
// Bundled via roboto-fontface (Vite asset URL). Server fetch resolves locally,
// no external CDN dependency.
import robotoRegularB64 from "@/assets/fonts/Roboto-Regular.ttf.base64";
import robotoBoldB64 from "@/assets/fonts/Roboto-Bold.ttf.base64";
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function loadUnicodeFonts() {
  return { regular: b64ToBytes(robotoRegularB64), bold: b64ToBytes(robotoBoldB64) };
}
async function embedUnicodeFonts(pdfDoc: any) {
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  pdfDoc.registerFontkit(fontkit);
  const { regular, bold } = await loadUnicodeFonts();
  const [font, fontB] = await Promise.all([
    pdfDoc.embedFont(regular, { subset: true }),
    pdfDoc.embedFont(bold, { subset: true }),
  ]);
  return { font, fontB };
}

async function embedSignatureAt(
  pdfDoc: any,
  page: any,
  dataUrl: string,
  box: { x: number; y: number; w: number; h: number },
) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const png = await pdfDoc.embedPng(arr);
  const ratio = png.width / png.height;
  let w = box.w;
  let h = w / ratio;
  if (h > box.h) { h = box.h; w = h * ratio; }
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  page.drawImage(png, { x, y, width: w, height: h });
}

async function buildOrderPdf(order: any, client: any): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Objednavka ${order.order_number}`);
  pdf.setCreator("AutoPort App");
  let page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const { font, fontB } = await embedUnicodeFonts(pdf);
  const black = rgb(0.10, 0.13, 0.18);
  const muted = rgb(...BRAND.muted);
  const primary = rgb(...BRAND.primary);
  const hair = rgb(...BRAND.hairline);
  const marginX = 48;

  const draw = (
    pg: any, text: string, x: number, y: number,
    o: { size?: number; bold?: boolean; color?: any } = {},
  ) => {
    pg.drawText(sanitize(text), {
      x, y, size: o.size ?? 9.5,
      font: o.bold ? fontB : font,
      color: o.color ?? black,
    });
  };

  // ===== Header band =====
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: rgb(...BRAND.dark) });
  page.drawRectangle({ x: 0, y: height - 94, width, height: 4, color: primary });
  draw(page, "AUTOPORT", marginX, height - 40, { size: 18, bold: true, color: rgb(1, 1, 1) });
  draw(page, "Objednavka predvadeciho vozu", marginX, height - 60, { size: 11, color: rgb(0.78, 0.82, 0.88) });
  draw(page, "AutoPort s.r.o.  -  Korytna 47, 100 00 Praha 10", marginX, height - 76, { size: 7.5, color: rgb(0.65, 0.7, 0.78) });
  draw(page, "IC 49614703  -  DIC CZ49614703", marginX, height - 85, { size: 7.5, color: rgb(0.65, 0.7, 0.78) });

  // Right side: order number + date
  const rNumLabel = "OBJEDNAVKA";
  draw(page, rNumLabel, width - marginX - 160, height - 40, { size: 8, color: rgb(0.78, 0.82, 0.88) });
  draw(page, order.order_number || "—", width - marginX - 160, height - 56, { size: 14, bold: true, color: rgb(1, 1, 1) });
  draw(page, "Datum vystaveni: " + fmtDate(order.datum_objednavky), width - marginX - 160, height - 76, { size: 8, color: rgb(0.78, 0.82, 0.88) });

  // ===== Two info cards: vehicle + client =====
  let y = height - 120;
  const cardW = (width - marginX * 2 - 16) / 2;
  const cardH = 170;

  const card = (x: number, title: string, rows: Array<[string, string]>) => {
    page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: rgb(...BRAND.panel) });
    page.drawRectangle({ x, y: y - 4, width: cardW, height: 4, color: primary });
    draw(page, title, x + 12, y - 22, { size: 10.5, bold: true });
    let ry = y - 42;
    for (const [k, v] of rows) {
      draw(page, k, x + 12, ry, { size: 8, color: muted });
      draw(page, v, x + 12, ry - 11, { size: 9.5, bold: true });
      ry -= 26;
    }
  };

  card(marginX, "VOZIDLO", [
    ["Model a verze", order.model_verze || "—"],
    ["VIN / RZ", order.vin || "—"],
    ["Barva", order.barva || "—"],
    ["Rok / km", `${order.rok_vyroby ?? "—"}  -  ${order.najete_km != null ? new Intl.NumberFormat("cs-CZ").format(order.najete_km) + " km" : "—"}`],
    ["Registrace / zaruka", `${fmtDate(order.registrace_datum)}  -  ${order.zaruka_spustena_od || "—"}`],
  ]);

  card(marginX + cardW + 16, "KLIENT", [
    ["Jmeno / Firma", [client?.full_name, client?.company].filter(Boolean).join(" - ") || "—"],
    ["IC / DIC", `${client?.ico || "—"}  -  ${client?.dic || "—"}`],
    ["Adresa", client?.address || "—"],
    ["Telefon", client?.phone || "—"],
    ["E-mail", client?.email || "—"],
  ]);

  y -= cardH + 26;

  // ===== Line items table =====
  draw(page, "POLOZKY OBJEDNAVKY", marginX, y, { size: 10.5, bold: true });
  y -= 6;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1.2, color: primary });
  y -= 16;

  const colBezX = width - marginX - 240;
  const colDphX = width - marginX - 160;
  const colSDphX = width - marginX - 70;
  draw(page, "Polozka", marginX, y, { size: 8, bold: true, color: muted });
  draw(page, "Bez DPH", colBezX, y, { size: 8, bold: true, color: muted });
  draw(page, "DPH", colDphX, y, { size: 8, bold: true, color: muted });
  draw(page, "S DPH", colSDphX, y, { size: 8, bold: true, color: muted });
  y -= 6;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 0.5, color: hair });
  y -= 14;

  const items = Array.isArray(order.line_items) ? order.line_items : [];
  let zebra = false;
  for (const it of items) {
    const bez = Number(it.bez_dph || 0);
    const dph = bez * (Number(it.dph_pct || 0) / 100);
    const s = bez + dph;
    if (zebra) {
      page.drawRectangle({ x: marginX - 2, y: y - 4, width: width - marginX * 2 + 4, height: 16, color: rgb(0.975, 0.975, 0.98) });
    }
    draw(page, it.label || "", marginX, y, { size: 9.5 });
    draw(page, fmtKc(bez), colBezX, y, { size: 9.5 });
    draw(page, fmtKc(dph), colDphX, y, { size: 9.5 });
    draw(page, fmtKc(s), colSDphX, y, { size: 9.5 });
    y -= 16;
    zebra = !zebra;
    if (y < 260) {
      page = pdf.addPage([595.28, 841.89]);
      y = height - 60;
    }
  }

  y -= 6;
  // Totals panel
  page.drawRectangle({ x: marginX, y: y - 56, width: width - marginX * 2, height: 56, color: rgb(...BRAND.dark) });
  page.drawRectangle({ x: marginX, y: y - 4, width: width - marginX * 2, height: 4, color: primary });
  draw(page, "CELKEM BEZ DPH", marginX + 16, y - 22, { size: 8, color: rgb(0.78, 0.82, 0.88) });
  draw(page, fmtKc(order.cena_celkem_bez_dph), marginX + 16, y - 40, { size: 14, bold: true, color: rgb(1, 1, 1) });

  draw(page, "ZALOHA", marginX + 220, y - 22, { size: 8, color: rgb(0.78, 0.82, 0.88) });
  draw(page, fmtKc(order.zaloha), marginX + 220, y - 40, { size: 14, bold: true, color: rgb(1, 1, 1) });

  draw(page, "K UHRADE S DPH", width - marginX - 170, y - 22, { size: 8, color: primary });
  draw(page, fmtKc(order.cena_celkem_s_dph), width - marginX - 170, y - 42, { size: 18, bold: true, color: rgb(1, 1, 1) });
  y -= 72;

  // Delivery + notes
  draw(page, "Datum dodani: ", marginX, y, { size: 9, color: muted });
  draw(page, fmtDate(order.datum_dodani), marginX + 70, y, { size: 9.5, bold: true });
  y -= 16;

  if (order.notes) {
    draw(page, "Poznamka:", marginX, y, { size: 9, color: muted });
    y -= 12;
    for (const line of String(order.notes).split(/\n/)) {
      if (y < 200) { page = pdf.addPage([595.28, 841.89]); y = height - 60; }
      draw(page, line, marginX, y, { size: 9 });
      y -= 12;
    }
  }

  // ===== Signature row (on the last page) =====
  // Lines
  page.drawLine({ start: { x: SIG.sellerX, y: SIG.lineY }, end: { x: SIG.sellerX + SIG.sellerW, y: SIG.lineY }, thickness: 0.6, color: rgb(0.4, 0.4, 0.45) });
  page.drawLine({ start: { x: SIG.buyerX, y: SIG.lineY }, end: { x: SIG.buyerX + SIG.buyerW, y: SIG.lineY }, thickness: 0.6, color: rgb(0.4, 0.4, 0.45) });
  draw(page, "Podpis prodavajiciho", SIG.sellerX, SIG.labelY, { size: 8, color: muted });
  draw(page, "Podpis kupujiciho", SIG.buyerX, SIG.labelY, { size: 8, color: muted });

  // Seller signature image (if present)
  if (order.seller_signature_data) {
    try {
      await embedSignatureAt(pdf, page, order.seller_signature_data, {
        x: SIG.sellerX, y: SIG.lineY + 4, w: SIG.sellerW, h: SIG.sellerH,
      });
      if (order.seller_signer_name) {
        draw(page, sanitize(order.seller_signer_name), SIG.sellerX, SIG.labelY, { size: 8, color: muted });
      }
    } catch { /* ignore embed errors */ }
  }

  // Footer
  page.drawLine({ start: { x: marginX, y: 40 }, end: { x: width - marginX, y: 40 }, thickness: 0.4, color: hair });
  draw(page, "AutoPort s.r.o.  -  Korytna 47, 100 00 Praha 10  -  IC 49614703  -  DIC CZ49614703", marginX, 30, { size: 7, color: muted });
  draw(page, "Vygenerovano AutoPort App  -  " + new Date().toLocaleString("cs-CZ"), marginX, 20, { size: 7, color: muted });
  return await pdf.save();
}

async function buildInvoicePdf(order: any, client: any, invoiceNumber: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const QRCode = (await import("qrcode")).default;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Zalohova faktura ${invoiceNumber}`);
  pdf.setCreator("AutoPort App");
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const { font, fontB } = await embedUnicodeFonts(pdf);
  const black = rgb(...BRAND.dark);
  const muted = rgb(...BRAND.muted);
  const primary = rgb(...BRAND.primary);
  const hair = rgb(...BRAND.hairline);
  const marginX = 48;

  const draw = (t: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: any } = {}) => {
    page.drawText(sanitize(t), { x, y, size: o.size ?? 9.5, font: o.bold ? fontB : font, color: o.color ?? black });
  };

  // Header
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: rgb(...BRAND.dark) });
  page.drawRectangle({ x: 0, y: height - 94, width, height: 4, color: primary });
  draw("AUTOPORT", marginX, height - 40, { size: 18, bold: true, color: rgb(1, 1, 1) });
  draw("Zalohova faktura", marginX, height - 60, { size: 11, color: rgb(0.78, 0.82, 0.88) });
  draw(invoiceNumber, width - marginX - 160, height - 40, { size: 16, bold: true, color: rgb(1, 1, 1) });
  draw("Datum vystaveni: " + fmtDate(new Date().toISOString()), width - marginX - 160, height - 60, { size: 8, color: rgb(0.78, 0.82, 0.88) });
  draw("Splatnost: " + fmtDate(new Date(Date.now() + 14 * 86400000).toISOString()), width - marginX - 160, height - 72, { size: 8, color: rgb(0.78, 0.82, 0.88) });

  let y = height - 120;
  const cardW = (width - marginX * 2 - 16) / 2;
  const cardH = 110;

  const card = (x: number, title: string, lines: string[]) => {
    page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: rgb(...BRAND.panel) });
    page.drawRectangle({ x, y: y - 4, width: cardW, height: 4, color: primary });
    draw(title, x + 12, y - 22, { size: 9, bold: true, color: muted });
    let ry = y - 40;
    for (const ln of lines) {
      draw(ln, x + 12, ry, { size: 9.5 });
      ry -= 14;
    }
  };

  card(marginX, "DODAVATEL", [
    "AutoPort s.r.o.",
    "Korytna 47, 100 00 Praha 10",
    "IC: 49614703   DIC: CZ49614703",
  ]);
  card(marginX + cardW + 16, "ODBERATEL", [
    [client?.full_name, client?.company].filter(Boolean).join(" - ") || "—",
    client?.address || "",
    `IC: ${client?.ico || "—"}   DIC: ${client?.dic || "—"}`,
    client?.email || "",
  ]);
  y -= cardH + 28;

  draw("PREDMET PLATBY", marginX, y, { size: 9, bold: true, color: muted });
  y -= 6;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1.2, color: primary });
  y -= 18;
  draw(`Zaloha na objednavku ${order.order_number}`, marginX, y, { size: 10, bold: true });
  y -= 14;
  draw(order.model_verze || "", marginX, y, { size: 9.5, color: muted });
  y -= 28;

  // Amount panel
  page.drawRectangle({ x: marginX, y: y - 70, width: width - marginX * 2, height: 70, color: rgb(...BRAND.dark) });
  page.drawRectangle({ x: marginX, y: y - 4, width: width - marginX * 2, height: 4, color: primary });
  draw("CASTKA K UHRADE", marginX + 16, y - 24, { size: 8, color: primary });
  draw(fmtKc(order.zaloha), marginX + 16, y - 52, { size: 24, bold: true, color: rgb(1, 1, 1) });
  draw("(zalohova faktura - po pripsani platby vystavime danovy doklad)", marginX + 16, y - 66, { size: 7.5, color: rgb(0.78, 0.82, 0.88) });
  y -= 90;

  // Bank details + Czech SPAYD QR code
  const BANK_ACCOUNT = "313393044";
  const BANK_CODE = "5500"; // Raiffeisenbank
  const BANK_NAME = "Raiffeisenbank a.s.";
  const iban = buildCzIban(BANK_ACCOUNT, BANK_CODE);
  const ibanPretty = iban.replace(/(.{4})/g, "$1 ").trim();
  const amount = Number(order.zaloha || 0).toFixed(2);
  const vs = (order.order_number || "").replace(/[^0-9]/g, "") || invoiceNumber.replace(/[^0-9]/g, "");
  const spayd = `SPD*1.0*ACC:${iban}*AM:${amount}*CC:CZK*X-VS:${vs}*MSG:ZALOHA ${order.order_number || invoiceNumber}`;

  draw("PLATEBNI UDAJE", marginX, y, { size: 9, bold: true, color: muted });
  y -= 6;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 0.5, color: hair });
  y -= 18;
  const blockTop = y;
  const kv2 = (k: string, v: string) => {
    draw(k, marginX, y, { size: 8.5, color: muted });
    draw(v, marginX + 130, y, { size: 10, bold: true });
    y -= 16;
  };
  kv2("Banka", BANK_NAME);
  kv2("Cislo uctu", `${BANK_ACCOUNT}/${BANK_CODE}`);
  kv2("IBAN", ibanPretty);
  kv2("Variabilni symbol", vs);
  kv2("Castka", `${amount} CZK`);

  // QR platba
  try {
    const qrDataUrl = await QRCode.toDataURL(spayd, { errorCorrectionLevel: "M", margin: 1, width: 320 });
    const qrBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImg = await pdf.embedPng(qrBytes);
    const qrSize = 110;
    const qrX = width - marginX - qrSize;
    const qrY = blockTop - qrSize + 8;
    page.drawRectangle({ x: qrX - 8, y: qrY - 22, width: qrSize + 16, height: qrSize + 30, color: rgb(1, 1, 1), borderColor: hair, borderWidth: 0.5 });
    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    draw("QR PLATBA", qrX + qrSize / 2 - 22, qrY - 14, { size: 8, bold: true, color: muted });
  } catch { /* ignore qr errors */ }

  // Footer
  page.drawLine({ start: { x: marginX, y: 40 }, end: { x: width - marginX, y: 40 }, thickness: 0.4, color: hair });
  draw("AutoPort s.r.o.  -  Korytna 47, 100 00 Praha 10  -  IC 49614703  -  DIC CZ49614703", marginX, 30, { size: 7, color: muted });
  draw("Vygenerovano AutoPort App  -  " + new Date().toLocaleString("cs-CZ"), marginX, 20, { size: 7, color: muted });
  return await pdf.save();
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function buildCzIban(account: string, bankCode: string, prefix = ""): string {
  const bban = bankCode.padStart(4, "0") + prefix.padStart(6, "0") + account.padStart(10, "0");
  // CZ -> 12, 35  => "123500" appended for check calc
  const check = 98 - mod97(bban + "123500");
  return "CZ" + check.toString().padStart(2, "0") + bban;
}

function mod97(num: string): number {
  let rem = 0;
  for (const ch of num) rem = (rem * 10 + (ch.charCodeAt(0) - 48)) % 97;
  return rem;
}

async function uploadAndRecord(args: {
  clientId: string;
  orderId: string;
  kind: string;
  fileName: string;
  bytes: Uint8Array;
  signed?: boolean;
}): Promise<{ storage_path: string; file_name: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const path = `${args.clientId}/${args.orderId}/${args.kind}-${Date.now()}.pdf`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("client-documents")
    .upload(path, args.bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);
  await supabaseAdmin.from("demo_order_documents" as never).insert({
    order_id: args.orderId,
    client_id: args.clientId,
    kind: args.kind,
    storage_path: path,
    file_name: args.fileName,
    mime: "application/pdf",
    signed_at: args.signed ? new Date().toISOString() : null,
  } as never);
  return { storage_path: path, file_name: args.fileName };
}

export const generateOrderPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase.from("demo_orders" as never).select("*").eq("id", data.orderId).maybeSingle();
    if (!order) throw new Error("Objednávka nenalezena");
    const { data: client } = await context.supabase.from("clients" as never).select("*").eq("id", (order as any).client_id).maybeSingle();
    const bytes = await buildOrderPdf(order, client);
    const file = `objednavka-${(order as any).order_number}.pdf`;
    const rec = await uploadAndRecord({ clientId: (order as any).client_id, orderId: data.orderId, kind: "order", fileName: file, bytes });
    await logEvent({
      orderId: data.orderId,
      type: "order_pdf_generated",
      message: `Vygenerováno PDF objednávky (${file}).`,
      actorId: context.userId,
    });
    return { ok: true, base64: bytesToBase64(bytes), file_name: rec.file_name };
  });

export const generateInvoicePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase.from("demo_orders" as never).select("*").eq("id", data.orderId).maybeSingle();
    if (!order) throw new Error("Objednávka nenalezena");
    if (!(order as any).zaloha || Number((order as any).zaloha) <= 0) {
      throw new Error("Objednávka nemá vyplněnou zálohu");
    }
    const { data: client } = await context.supabase.from("clients" as never).select("*").eq("id", (order as any).client_id).maybeSingle();

    let invoiceNumber = (order as any).invoice_number as string | null;
    if (!invoiceNumber) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: nextNum, error: seqErr } = await supabaseAdmin.rpc("next_demo_invoice_number" as any);
      if (seqErr || !nextNum) throw new Error("Nepodařilo se vygenerovat číslo faktury: " + (seqErr?.message || "prázdná odpověď"));
      invoiceNumber = String(nextNum);
      await supabaseAdmin.from("demo_orders" as never).update({ invoice_number: invoiceNumber } as never).eq("id", data.orderId);
    }
    const bytes = await buildInvoicePdf(order, client, invoiceNumber);
    const file = `zalohova-faktura-${invoiceNumber}.pdf`;
    const rec = await uploadAndRecord({ clientId: (order as any).client_id, orderId: data.orderId, kind: "invoice", fileName: file, bytes });
    await logEvent({
      orderId: data.orderId,
      type: "invoice_pdf_generated",
      message: `Vygenerována zálohová faktura ${invoiceNumber}.`,
      actorId: context.userId,
    });
    return { ok: true, base64: bytesToBase64(bytes), file_name: rec.file_name, invoiceNumber };
  });

async function buildSignedFromBase(baseBytes: Uint8Array, signatureDataUrl: string, signerName: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.load(baseBytes);
  const pages = pdf.getPages();
  const last = pages[pages.length - 1];
  const { font } = await embedUnicodeFonts(pdf);

  await embedSignatureAt(pdf, last, signatureDataUrl, {
    x: SIG.buyerX, y: SIG.lineY + 4, w: SIG.buyerW, h: SIG.buyerH,
  });
  last.drawText(sanitize(`${signerName}  -  ${new Date().toLocaleString("cs-CZ")}`), {
    x: SIG.buyerX, y: SIG.labelY - 10, size: 7.5, font, color: rgb(0.42, 0.46, 0.52),
  });
  return await pdf.save();
}

async function fetchLatestDoc(orderId: string, kind: "order" | "invoice") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("demo_order_documents" as never)
    .select("*")
    .eq("order_id", orderId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = ((data ?? []) as any[])[0];
  if (!row) return null;
  const { data: file, error } = await supabaseAdmin.storage.from("client-documents").download(row.storage_path);
  if (error || !file) return null;
  const buf = new Uint8Array(await file.arrayBuffer());
  return { row, bytes: buf };
}

export const signOrderInPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      signatureDataUrl: z.string().min(20),
      signerName: z.string().trim().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const base = await fetchLatestDoc(data.orderId, "order");
    if (!base) throw new Error("Nejprve vygenerujte PDF objednávky");
    const signed = await buildSignedFromBase(base.bytes, data.signatureDataUrl, data.signerName);
    const { data: order } = await context.supabase.from("demo_orders" as never).select("client_id,order_number").eq("id", data.orderId).maybeSingle();
    const file = `objednavka-podepsana-${(order as any)?.order_number || data.orderId}.pdf`;
    await uploadAndRecord({
      clientId: (order as any).client_id,
      orderId: data.orderId,
      kind: "order_signed",
      fileName: file,
      bytes: signed,
      signed: true,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("demo_order_signatures" as never).insert({
      order_id: data.orderId,
      mode: "in_person",
      signer_name: data.signerName,
      signature_data: data.signatureDataUrl,
      signed_at: new Date().toISOString(),
    } as never);
    await supabaseAdmin.from("demo_orders" as never).update({ status: "signed" } as never).eq("id", data.orderId);
    await logEvent({
      orderId: data.orderId,
      type: "signed_in_person",
      message: `Klient podepsal objednávku u prodejce (${data.signerName}).`,
      actorId: context.userId,
    });
    return { ok: true };
  });

export const saveSellerSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      signatureDataUrl: z.string().min(20),
      signerName: z.string().trim().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("demo_orders" as never)
      .update({
        seller_signature_data: data.signatureDataUrl,
        seller_signer_name: data.signerName,
        seller_signed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    await logEvent({
      orderId: data.orderId,
      type: "seller_signed",
      message: `Prodejce vložil podpis (${data.signerName}).`,
      actorId: context.userId,
    });
    return { ok: true };
  });

export const clearSellerSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("demo_orders" as never)
      .update({
        seller_signature_data: null,
        seller_signer_name: null,
        seller_signed_at: null,
      } as never)
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    await logEvent({
      orderId: data.orderId,
      type: "seller_signature_cleared",
      message: "Podpis prodejce byl odstraněn.",
      actorId: context.userId,
    });
    return { ok: true };
  });

export const createRemoteSignatureLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase.from("demo_orders" as never).select("client_id,order_number,model_verze").eq("id", data.orderId).maybeSingle();
    if (!order) throw new Error("Objednávka nenalezena");
    const { data: client } = await context.supabase.from("clients" as never).select("full_name,email").eq("id", (order as any).client_id).maybeSingle();
    if (!(client as any)?.email) throw new Error("Klient nemá vyplněn e-mail");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 7 * 86400000).toISOString();
    await supabaseAdmin.from("demo_order_signatures" as never).insert({
      order_id: data.orderId,
      mode: "remote",
      token,
      token_expires_at: expires,
    } as never);
    await supabaseAdmin.from("demo_orders" as never).update({ status: "sent_for_signature" } as never).eq("id", data.orderId);

    const link = `https://www.autoport-app.cz/sign/${token}`;
    const { enqueueTransactionalEmail } = await import("@/lib/email/notify.server");
    await enqueueTransactionalEmail({
      templateName: "demo-order-signature-request",
      recipientEmail: (client as any).email,
      idempotencyKey: `demo-sig-${data.orderId}-${token}`,
      templateData: {
        recipientName: (client as any).full_name || "",
        orderNumber: (order as any).order_number,
        modelVerze: (order as any).model_verze || "",
        signUrl: link,
        expiresAt: expires,
      },
    });
    await logEvent({
      orderId: data.orderId,
      type: "signature_link_sent",
      message: `Odeslán e-mail klientovi (${(client as any).email}) s odkazem pro elektronický podpis.`,
      actorId: context.userId,
      meta: { recipient: (client as any).email, expires_at: expires },
    });
    return { ok: true, signUrl: link };
  });

// ============= Public (no auth) endpoints for remote sign =============

export const getOrderByToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sig } = await supabaseAdmin
      .from("demo_order_signatures" as never)
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!sig) throw new Error("Neplatný odkaz");
    if ((sig as any).consumed_at) throw new Error("Tento odkaz již byl použit");
    if (new Date((sig as any).token_expires_at).getTime() < Date.now()) throw new Error("Platnost odkazu vypršela");
    const { data: order } = await supabaseAdmin.from("demo_orders" as never).select("*").eq("id", (sig as any).order_id).maybeSingle();
    const { data: client } = await supabaseAdmin.from("clients" as never).select("full_name,company,email").eq("id", (order as any).client_id).maybeSingle();
    // Latest order PDF
    const base = await fetchLatestDoc((order as any).id, "order");
    return {
      order: { id: (order as any).id, order_number: (order as any).order_number, model_verze: (order as any).model_verze, cena_celkem_s_dph: (order as any).cena_celkem_s_dph },
      client: client as any,
      pdfBase64: base ? bytesToBase64(base.bytes) : null,
    };
  });

export const signOrderRemote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: z.string().uuid(),
      signatureDataUrl: z.string().min(20),
      signerName: z.string().trim().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sig } = await supabaseAdmin.from("demo_order_signatures" as never).select("*").eq("token", data.token).maybeSingle();
    if (!sig) throw new Error("Neplatný odkaz");
    if ((sig as any).consumed_at) throw new Error("Tento odkaz již byl použit");
    if (new Date((sig as any).token_expires_at).getTime() < Date.now()) throw new Error("Platnost odkazu vypršela");
    const orderId = (sig as any).order_id as string;

    const base = await fetchLatestDoc(orderId, "order");
    if (!base) throw new Error("Objednávka nemá vygenerované PDF");
    const signed = await buildSignedFromBase(base.bytes, data.signatureDataUrl, data.signerName);
    const { data: order } = await supabaseAdmin.from("demo_orders" as never).select("client_id,order_number").eq("id", orderId).maybeSingle();
    const file = `objednavka-podepsana-${(order as any)?.order_number || orderId}.pdf`;
    await uploadAndRecord({
      clientId: (order as any).client_id,
      orderId,
      kind: "order_signed",
      fileName: file,
      bytes: signed,
      signed: true,
    });
    await supabaseAdmin.from("demo_order_signatures" as never).update({
      signer_name: data.signerName,
      signature_data: data.signatureDataUrl,
      signed_at: new Date().toISOString(),
      consumed_at: new Date().toISOString(),
    } as never).eq("id", (sig as any).id);
    await supabaseAdmin.from("demo_orders" as never).update({ status: "signed" } as never).eq("id", orderId);
    await logEvent({
      orderId,
      type: "signed_remote",
      message: `Klient elektronicky podepsal objednávku (${data.signerName}).`,
      actorId: null,
    });
    return { ok: true };
  });

export const sendDocumentsToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase.from("demo_orders" as never).select("client_id,order_number,model_verze").eq("id", data.orderId).maybeSingle();
    if (!order) throw new Error("Objednávka nenalezena");
    const { data: client } = await context.supabase.from("clients" as never).select("full_name,email").eq("id", (order as any).client_id).maybeSingle();
    if (!(client as any)?.email) throw new Error("Klient nemá vyplněn e-mail");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pickKinds = ["order_signed", "order", "invoice"];
    const picked: Record<string, { storage_path: string; file_name: string } | null> = {
      order: null, invoice: null,
    };
    for (const kind of pickKinds) {
      const { data: rows } = await supabaseAdmin
        .from("demo_order_documents" as never)
        .select("storage_path,file_name,kind")
        .eq("order_id", data.orderId)
        .eq("kind", kind)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = ((rows ?? []) as any[])[0];
      if (!row) continue;
      const target = kind === "invoice" ? "invoice" : "order";
      if (!picked[target]) picked[target] = { storage_path: row.storage_path, file_name: row.file_name };
    }

    if (!picked.order && !picked.invoice) throw new Error("Žádné dokumenty k odeslání");

    async function sign(p: { storage_path: string; file_name: string } | null) {
      if (!p) return null;
      const { data: s } = await supabaseAdmin.storage.from("client-documents").createSignedUrl(p.storage_path, 7 * 86400);
      return s?.signedUrl || null;
    }
    const orderUrl = await sign(picked.order);
    const invoiceUrl = await sign(picked.invoice);

    const { enqueueTransactionalEmail } = await import("@/lib/email/notify.server");
    await enqueueTransactionalEmail({
      templateName: "demo-order-documents",
      recipientEmail: (client as any).email,
      idempotencyKey: `demo-docs-${data.orderId}-${Date.now()}`,
      templateData: {
        recipientName: (client as any).full_name || "",
        orderNumber: (order as any).order_number,
        modelVerze: (order as any).model_verze || "",
        orderUrl,
        invoiceUrl,
      },
    });
    await logEvent({
      orderId: data.orderId,
      type: "documents_sent",
      message: `Odeslán e-mail klientovi (${(client as any).email}) s dokumenty${
        picked.order && picked.invoice ? " (objednávka + faktura)"
        : picked.order ? " (objednávka)"
        : " (faktura)"
      }.`,
      actorId: context.userId,
      meta: { recipient: (client as any).email },
    });
    return { ok: true };
  });

export const getDocumentDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("demo_order_documents" as never)
      .select("storage_path,file_name")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!row) throw new Error("Dokument nenalezen");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.storage.from("client-documents").createSignedUrl((row as any).storage_path, 3600);
    if (!s?.signedUrl) throw new Error("Nelze vytvořit odkaz");
    return { url: s.signedUrl, file_name: (row as any).file_name as string };
  });