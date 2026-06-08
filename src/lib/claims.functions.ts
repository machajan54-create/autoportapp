import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const attachmentSchema = z.object({
  category: z.string(),
  file_path: z.string(),
  file_name: z.string(),
  mime_type: z.string().optional(),
  size: z.number().optional(),
});

const claimInput = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  company: z.string().optional().nullable(),
  ico: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  insurer: z.string().optional().nullable(),
  claim_number: z.string().optional().nullable(),
  event_at: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  liquidation_type: z.string().optional().nullable(),
  vat_payer: z.string().optional().nullable(),
  loan_lease: z.string().optional().nullable(),
  accident_record: z.string().optional().nullable(),
  insurer_record: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  signature: z.string().min(10),
  attachments: z.array(attachmentSchema).optional().default([]),
});

export const createClaim = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => claimInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { attachments, email, event_at, ...rest } = data;
    const { data: claim, error } = await supabaseAdmin
      .from("claims")
      .insert({
        ...rest,
        email: email || null,
        event_at: event_at || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (attachments && attachments.length) {
      const rows = attachments.map((a) => ({ ...a, claim_id: claim.id }));
      const { error: aerr } = await supabaseAdmin.from("claim_attachments").insert(rows);
      if (aerr) throw new Error(aerr.message);
    }
    return { id: claim.id };
  });

export const listClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("claims")
      .select("id,pu_number,status,vat_paid,first_name,last_name,phone,insurer,claim_number,event_at,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: claim, error } = await context.supabase
      .from("claims")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: attachments } = await context.supabase
      .from("claim_attachments")
      .select("*")
      .eq("claim_id", data.id)
      .order("created_at", { ascending: true });
    const signed = await Promise.all(
      (attachments ?? []).map(async (a) => {
        const { data: s } = await context.supabase.storage
          .from("claim-files")
          .createSignedUrl(a.file_path, 3600);
        return { ...a, url: s?.signedUrl ?? null };
      })
    );
    const { data: events } = await context.supabase
      .from("claim_events")
      .select("*")
      .eq("claim_id", data.id)
      .order("created_at", { ascending: false });
    const { data: tasks } = await context.supabase
      .from("claim_tasks")
      .select("*")
      .eq("claim_id", data.id)
      .order("created_at", { ascending: true });
    return { claim, attachments: signed, events: events ?? [], tasks: tasks ?? [] };
  });

export const updateClaimStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "in_repair", "waiting_vat", "done", "in_progress", "closed"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("claims")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("claim_events")
      .insert({ claim_id: data.id, type: "status", message: `Stav změněn na ${data.status}` });
    return { ok: true };
  });

export const setVatPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), paid: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("claims")
      .update({ vat_paid: data.paid })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("claim_events")
      .insert({
        claim_id: data.id,
        type: "vat",
        message: data.paid ? "DPH označeno jako zaplacené" : "DPH vráceno do nezaplaceno",
      });
    return { ok: true };
  });

export const addTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ claim_id: z.string().uuid(), title: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("claim_tasks")
      .insert({ claim_id: data.claim_id, title: data.title });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("claim_tasks")
      .update({ done: data.done })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("claim_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const notifyClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: claim } = await context.supabase
      .from("claims")
      .select("email,first_name,last_name,pu_number")
      .eq("id", data.id)
      .single();
    if (!claim?.email) throw new Error("Klient neuvedl e-mail.");
    await context.supabase.from("claim_events").insert({
      claim_id: data.id,
      type: "notify",
      message: `Odesláno upozornění klientovi na ${claim.email}`,
    });
    return { ok: true, email: claim.email };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id,email,full_name,created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await context.supabase.from("user_roles").select("user_id,role");
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ user_id: z.string().uuid(), role: z.enum(["admin", "employee"]), enable: z.boolean() })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enable) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
    }
    return { ok: true };
  });

export const ensureDemoUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = "demo@pojistne.app";
  const password = "demo1234";
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list?.users.find((u) => u.email === email);
  if (!user) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Demo Admin" },
    });
    if (error) throw new Error(error.message);
    user = created.user!;
  }
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
  return { email, password };
});

export const generatePoaPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), kind: z.enum(["jednani", "plneni"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: claim, error } = await context.supabase
      .from("claims")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ascii = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\x7F]/g, "");
    const title =
      data.kind === "jednani"
        ? "PLNA MOC k jednani s pojistovnou"
        : "PLNA MOC k prevzeti pojistneho plneni";
    page.drawText(title, { x: 50, y: 790, size: 16, font: bold, color: rgb(0, 0, 0) });
    const lines = [
      `Zmocnitel: ${claim.first_name} ${claim.last_name}`,
      claim.company ? `Spolecnost: ${claim.company}` : "",
      claim.ico ? `IC: ${claim.ico}` : "",
      claim.address ? `Adresa: ${claim.address}` : "",
      `Telefon: ${claim.phone}`,
      claim.email ? `E-mail: ${claim.email}` : "",
      "",
      "Zmocnenec: Pojistne udalosti s.r.o., IC 12345678",
      "",
      `Pojistovna: ${claim.insurer ?? "-"}`,
      `Cislo skody: ${claim.claim_number ?? "-"}`,
      claim.event_at ? `Datum udalosti: ${new Date(claim.event_at).toLocaleString("cs-CZ")}` : "",
      claim.location ? `Misto udalosti: ${claim.location}` : "",
      "",
      data.kind === "jednani"
        ? "Zmocnuji vyse uvedeneho zmocnence k zastupovani pri jednani s pojistovnou"
        : "Zmocnuji vyse uvedeneho zmocnence k prevzeti pojistneho plneni",
      "ve veci nahore uvedene pojistne udalosti v plnem rozsahu.",
    ].filter(Boolean);
    let y = 750;
    for (const ln of lines) {
      page.drawText(ascii(ln), { x: 50, y, size: 11, font });
      y -= 18;
    }
    if (claim.signature?.startsWith("data:image/png")) {
      try {
        const b64 = claim.signature.split(",")[1];
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const png = await pdf.embedPng(bytes);
        page.drawText(ascii("Podpis zmocnitele:"), { x: 50, y: y - 30, size: 11, font });
        const dims = png.scale(0.5);
        page.drawImage(png, {
          x: 50,
          y: y - 30 - Math.min(dims.height, 80),
          width: Math.min(dims.width, 200),
          height: Math.min(dims.height, 80),
        });
      } catch {
        // ignore
      }
    }
    page.drawText(`Datum: ${new Date().toLocaleDateString("cs-CZ")}`, {
      x: 50,
      y: 60,
      size: 10,
      font,
    });
    const bytes = await pdf.save();
    return { base64: Buffer.from(bytes).toString("base64") };
  });

// Public photo upload (used by mobile via QR code). No auth required — gated by upload_token.
export const publicGetClaimByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claim, error } = await supabaseAdmin
      .from("claims")
      .select("id,pu_number,first_name,last_name")
      .eq("upload_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claim) throw new Error("Neplatný odkaz.");
    return claim;
  });

export const publicUploadPhoto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().uuid(),
        file_name: z.string().min(1).max(200),
        mime_type: z.string().min(1).max(100),
        data_base64: z.string().min(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claim, error } = await supabaseAdmin
      .from("claims")
      .select("id")
      .eq("upload_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claim) throw new Error("Neplatný token.");
    const safe = data.file_name.replace(/[^\w.-]/g, "_");
    const path = `${claim.id}/qr/${Date.now()}-${safe}`;
    const bytes = Buffer.from(data.data_base64, "base64");
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Soubor je větší než 8 MB.");
    const { error: uerr } = await supabaseAdmin.storage
      .from("claim-files")
      .upload(path, bytes, { contentType: data.mime_type, upsert: false });
    if (uerr) throw new Error(uerr.message);
    await supabaseAdmin.from("claim_attachments").insert({
      claim_id: claim.id,
      category: "photos",
      file_path: path,
      file_name: data.file_name,
      mime_type: data.mime_type,
      size: bytes.byteLength,
    });
    await supabaseAdmin.from("claim_events").insert({
      claim_id: claim.id,
      type: "photo",
      message: "Nahráno 1 fotek přes QR kód",
    });
    return { ok: true };
  });