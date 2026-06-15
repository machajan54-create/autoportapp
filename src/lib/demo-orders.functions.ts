import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      .select("id,order_number,invoice_number,status,model_verze,cena_celkem_s_dph,datum_objednavky,created_at,client_id")
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
    return {
      order: order as any,
      client: client as any,
      documents: (docs ?? []) as any[],
      signatures: (sigs ?? []) as any[],
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
    return { ok: true };
  });

export const deleteDemoOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: docs } = await supabaseAdmin
      .from("demo_order_documents" as never)
      .select("storage_path")
      .eq("order_id", data.id);
    const paths = ((docs ?? []) as any[]).map((d) => d.storage_path).filter(Boolean);
    if (paths.length) await supabaseAdmin.storage.from("client-documents").remove(paths);
    const { error } = await supabaseAdmin.from("demo_orders" as never).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= PDF helpers =============

function sanitize(s: string): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e\n]/g, "?");
}

function fmtKc(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("cs-CZ").format(Number(n)) + " Kc";
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("cs-CZ");
}

async function buildOrderPdf(order: any, client: any): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Objednavka ${order.order_number}`);
  pdf.setCreator("AutoPort App");
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.45, 0.45, 0.45);
  const accent = rgb(0.86, 0.16, 0.16);
  const marginX = 40;

  const draw = (text: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: any } = {}) => {
    page.drawText(sanitize(text), {
      x, y,
      size: opts.size ?? 9,
      font: opts.bold ? fontB : font,
      color: opts.color ?? black,
    });
  };

  // Top company line
  page.drawRectangle({ x: 0, y: height - 28, width, height: 28, color: rgb(0.97, 0.97, 0.97) });
  draw("AutoPort s.r.o., Korytna 47, 10000 Praha 10, ICO 49614703, DIC CZ49614703", marginX, height - 18, { size: 8, color: gray });
  draw("Firma je zapsana u Mestskeho soudu v Praze odd. C, vlozka 21084", marginX, height - 26, { size: 7, color: gray });

  // Title bar
  let y = height - 60;
  page.drawRectangle({ x: marginX, y: y - 4, width: width - marginX * 2, height: 28, color: rgb(0.13, 0.13, 0.13) });
  draw("Objednavka predvadeciho vozu CITROEN", marginX + 14, y + 6, { size: 14, bold: true, color: rgb(1, 1, 1) });
  y -= 26;

  // Number / date
  y -= 22;
  draw("Cislo objednavky:", marginX + 12, y, { size: 9, bold: true });
  draw(order.order_number || "—", marginX + 120, y, { size: 9 });
  draw("Datum:", width - marginX - 120, y, { size: 9, bold: true });
  draw(fmtDate(order.datum_objednavky), width - marginX - 70, y, { size: 9 });

  // Vehicle section
  y -= 22;
  const section = (title: string) => {
    page.drawLine({ start: { x: marginX, y: y + 4 }, end: { x: width - marginX, y: y + 4 }, thickness: 0.6, color: rgb(0.8, 0.8, 0.8) });
    draw(title, marginX, y - 8, { size: 10, bold: true, color: accent });
    y -= 22;
  };
  const kv = (k: string, v: string) => {
    draw(k, marginX, y, { size: 9, color: gray });
    draw(v, marginX + 170, y, { size: 9 });
    y -= 14;
  };

  section("Vozidlo");
  kv("Model a verze:", order.model_verze || "—");
  kv("Zaruka spustena od:", order.zaruka_spustena_od || "—");
  kv("Registrace vozu:", fmtDate(order.registrace_datum));
  kv("Ojety vuz - max. km:", order.najete_km != null ? new Intl.NumberFormat("cs-CZ").format(order.najete_km) : "—");
  kv("VIN / RZ:", order.vin || "—");

  section("Klient");
  kv("Jmeno / Firma:", [client?.full_name, client?.company].filter(Boolean).join(" — ") || "—");
  kv("IC:", client?.ico || "—");
  kv("Adresa:", client?.address || "—");
  kv("Telefon:", client?.phone || "—");
  kv("E-mail:", client?.email || "—");

  // Price table
  section("Cenik");
  // header
  draw("Polozka", marginX, y, { size: 9, bold: true });
  draw("Bez DPH", width - marginX - 240, y, { size: 9, bold: true });
  draw("DPH", width - marginX - 150, y, { size: 9, bold: true });
  draw("Vcetne DPH", width - marginX - 80, y, { size: 9, bold: true });
  y -= 12;
  page.drawLine({ start: { x: marginX, y: y + 4 }, end: { x: width - marginX, y: y + 4 }, thickness: 0.4, color: rgb(0.85, 0.85, 0.85) });

  const items = Array.isArray(order.line_items) ? order.line_items : [];
  for (const it of items) {
    const bez = Number(it.bez_dph || 0);
    const dph = bez * (Number(it.dph_pct || 0) / 100);
    const s = bez + dph;
    draw(it.label || "", marginX, y, { size: 9 });
    draw(fmtKc(bez), width - marginX - 240, y, { size: 9 });
    draw(fmtKc(dph), width - marginX - 150, y, { size: 9 });
    draw(fmtKc(s), width - marginX - 80, y, { size: 9 });
    y -= 13;
    if (y < 160) { y = height - 60; pdf.addPage([595.28, 841.89]); }
  }
  y -= 6;
  // Totals box
  page.drawRectangle({ x: marginX, y: y - 18, width: width - marginX * 2, height: 22, color: rgb(1, 0.93, 0.4) });
  draw("Cena celkem", marginX + 8, y - 12, { size: 11, bold: true });
  draw(fmtKc(order.cena_celkem_bez_dph), width - marginX - 240, y - 12, { size: 11, bold: true });
  draw(fmtKc(order.cena_celkem_s_dph), width - marginX - 80, y - 12, { size: 11, bold: true });
  y -= 36;

  if (order.notes) {
    section("Poznamka");
    for (const line of String(order.notes).split(/\n/)) {
      draw(line, marginX, y, { size: 9 });
      y -= 12;
    }
  }

  // Delivery / deposit / signatures
  y -= 20;
  draw("Datum dodani:", marginX, y, { size: 9, bold: true });
  draw(fmtDate(order.datum_dodani), marginX + 90, y, { size: 9 });
  draw("Zaloha na vuz:", marginX + 220, y, { size: 9, bold: true });
  draw(fmtKc(order.zaloha), marginX + 310, y, { size: 9 });
  draw("Datum:", width - marginX - 100, y, { size: 9, bold: true });
  draw(fmtDate(new Date().toISOString()), width - marginX - 60, y, { size: 9 });

  y -= 60;
  page.drawLine({ start: { x: marginX, y }, end: { x: marginX + 200, y }, thickness: 0.5 });
  page.drawLine({ start: { x: width - marginX - 200, y }, end: { x: width - marginX, y }, thickness: 0.5 });
  draw("Podpis prodavajiciho", marginX, y - 12, { size: 8, color: gray });
  draw("Podpis kupujiciho", width - marginX - 200, y - 12, { size: 8, color: gray });

  draw("Vygenerovano AutoPort App — " + new Date().toLocaleString("cs-CZ"), marginX, 24, { size: 7, color: gray });
  return await pdf.save();
}

async function buildInvoicePdf(order: any, client: any, invoiceNumber: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Zalohova faktura ${invoiceNumber}`);
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gray = rgb(0.45, 0.45, 0.45);
  const marginX = 48;

  const draw = (t: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: any } = {}) => {
    page.drawText(sanitize(t), { x, y, size: o.size ?? 10, font: o.bold ? fontB : font, color: o.color ?? rgb(0, 0, 0) });
  };

  let y = height - 60;
  draw("ZALOHOVA FAKTURA", marginX, y, { size: 18, bold: true });
  draw(invoiceNumber, width - marginX - 100, y, { size: 14, bold: true });
  y -= 30;
  draw("Datum vystaveni: " + fmtDate(new Date().toISOString()), marginX, y, { size: 9, color: gray });
  draw("Datum splatnosti: " + fmtDate(new Date(Date.now() + 14 * 86400000).toISOString()), width - marginX - 180, y, { size: 9, color: gray });
  y -= 28;

  // supplier + customer
  draw("Dodavatel", marginX, y, { size: 10, bold: true });
  draw("Odberatel", width / 2, y, { size: 10, bold: true });
  y -= 14;
  const supplier = ["AutoPort s.r.o.", "Korytna 47, 100 00 Praha 10", "IC: 49614703  DIC: CZ49614703"];
  const customer = [
    [client?.full_name, client?.company].filter(Boolean).join(" — ") || "—",
    client?.address || "",
    `IC: ${client?.ico || "—"}  DIC: ${client?.dic || "—"}`,
  ];
  for (let i = 0; i < Math.max(supplier.length, customer.length); i++) {
    if (supplier[i]) draw(supplier[i], marginX, y, { size: 9 });
    if (customer[i]) draw(customer[i], width / 2, y, { size: 9 });
    y -= 12;
  }

  y -= 20;
  draw("Predmet platby", marginX, y, { size: 10, bold: true });
  y -= 16;
  draw(`Zaloha na objednavku ${order.order_number} — ${order.model_verze || ""}`, marginX, y, { size: 9 });
  y -= 30;

  // amount box
  page.drawRectangle({ x: marginX, y: y - 50, width: width - marginX * 2, height: 60, color: rgb(0.96, 0.96, 0.96) });
  draw("Castka k uhrade", marginX + 14, y - 14, { size: 10, bold: true });
  draw(fmtKc(order.zaloha), width - marginX - 130, y - 18, { size: 18, bold: true });
  draw("(zaloha neni dokladem o prijeti platby)", marginX + 14, y - 34, { size: 8, color: gray });
  y -= 80;

  draw("Platebni udaje", marginX, y, { size: 10, bold: true });
  y -= 14;
  draw("Banka: doplnit", marginX, y, { size: 9 }); y -= 12;
  draw("Cislo uctu: doplnit", marginX, y, { size: 9 }); y -= 12;
  draw("Variabilni symbol: " + invoiceNumber.replace(/[^0-9]/g, ""), marginX, y, { size: 9 });

  draw("Vygenerovano AutoPort App — " + new Date().toLocaleString("cs-CZ"), marginX, 24, { size: 7, color: gray });
  return await pdf.save();
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
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
      const { data: seq, error: seqErr } = await supabaseAdmin.rpc("nextval" as any, { sequence_name: "public.demo_invoice_seq" } as any);
      let n: number;
      if (seqErr || seq == null) {
        // fallback: use timestamp-derived number
        n = Math.floor(Math.random() * 9000) + 1000;
      } else {
        n = Number(seq);
      }
      invoiceNumber = `ZF-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
      await supabaseAdmin.from("demo_orders" as never).update({ invoice_number: invoiceNumber } as never).eq("id", data.orderId);
    }
    const bytes = await buildInvoicePdf(order, client, invoiceNumber);
    const file = `zalohova-faktura-${invoiceNumber}.pdf`;
    const rec = await uploadAndRecord({ clientId: (order as any).client_id, orderId: data.orderId, kind: "invoice", fileName: file, bytes });
    return { ok: true, base64: bytesToBase64(bytes), file_name: rec.file_name, invoiceNumber };
  });

async function buildSignedFromBase(baseBytes: Uint8Array, signatureDataUrl: string, signerName: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.load(baseBytes);
  const pages = pdf.getPages();
  const last = pages[pages.length - 1];
  const { width } = last.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const dataUrl = signatureDataUrl;
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const png = await pdf.embedPng(arr);
  const sigW = 180;
  const sigH = (png.height / png.width) * sigW;
  const x = width - 48 - sigW;
  const y = 70;
  last.drawImage(png, { x, y, width: sigW, height: sigH });
  last.drawText(sanitize(`Podepsal: ${signerName}`), { x, y: y - 12, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
  last.drawText(sanitize(`${new Date().toLocaleString("cs-CZ")}`), { x, y: y - 22, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
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