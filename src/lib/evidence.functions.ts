import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const loadNotify = () => import("@/lib/email/notify.server");
const APP_BASE = "https://www.autoport-app.cz";

const orderInput = z.object({
  klient: z.string().min(1).max(255),
  vozidlo: z.string().min(1).max(255),
  vis: z.string().max(50).optional().nullable(),
  den: z.string().max(20).optional().nullable(),
  hodina: z.string().max(20).optional().nullable(),
  kdo_predava: z.string().max(120).optional().nullable(),
  cislo_zakazky: z.string().max(50).optional().nullable(),
  poznamka: z.string().max(2000).optional().nullable(),
  stav: z.enum(["nova", "predano", "zruseno"]).optional(),
  pickup_from: z.string().max(40).optional().nullable(),
  complete_by: z.string().max(40).optional().nullable(),
});

function cleanRow<T extends Record<string, any>>(d: T): T {
  const out: any = { ...d };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k] = null;
  }
  return out;
}

/* ============ ORDERS ============ */

export const listEvidenceOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("evidence_orders")
      .select("*")
      .order("den", { ascending: true, nullsFirst: false })
      .order("hodina", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const orders = data ?? [];
    if (!orders.length) return [];
    const ids = orders.map((o: any) => o.id);
    const { data: assigns } = await context.supabase
      .from("evidence_wash_assignments")
      .select("*, washer:washers(id,name,email)")
      .in("order_id", ids);
    const byOrder = new Map<string, any[]>();
    for (const a of assigns ?? []) {
      const arr = byOrder.get(a.order_id) ?? [];
      arr.push(a);
      byOrder.set(a.order_id, arr);
    }
    return orders.map((o: any) => ({ ...o, assignments: byOrder.get(o.id) ?? [] }));
  });

export const createEvidenceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderInput.parse(d))
  .handler(async ({ context, data }) => {
    const { error, data: row } = await context.supabase
      .from("evidence_orders")
      .insert({ ...cleanRow(data), created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateEvidenceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: orderInput.partial() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("evidence_orders")
      .update(cleanRow(data.patch))
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ WASHERS ============ */

export const listWashers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("washers")
      .select("*")
      .order("active", { ascending: false })
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const washerInput = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  active: z.boolean().optional(),
});

export const createWasher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => washerInput.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("washers")
      .insert({ ...data, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateWasher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: washerInput.partial() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("washers").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWasher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("washers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ WASH ASSIGNMENTS ============ */

function fmtDen(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("cs-CZ");
  } catch {
    return d ?? "";
  }
}

export const assignWasher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ order_id: z.string().uuid(), washer_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    // Load order and washer
    const [{ data: order }, { data: washer }] = await Promise.all([
      context.supabase.from("evidence_orders").select("*").eq("id", data.order_id).maybeSingle(),
      context.supabase
        .from("washers")
        .select("id, name, email, active")
        .eq("id", data.washer_id)
        .maybeSingle(),
    ]);
    if (!order) throw new Error("Zakázka nebyla nalezena.");
    if (!washer) throw new Error("Myč nebyl nalezen.");
    if (washer.active === false) throw new Error("Myč není aktivní.");

    // Upsert assignment (reset to pending on re-send)
    const { data: existing } = await context.supabase
      .from("evidence_wash_assignments")
      .select("id, confirm_token")
      .eq("order_id", data.order_id)
      .eq("washer_id", data.washer_id)
      .maybeSingle();

    let token = existing?.confirm_token as string | undefined;
    if (existing) {
      const { error } = await context.supabase
        .from("evidence_wash_assignments")
        .update({ status: "pending", sent_at: new Date().toISOString(), decided_at: null })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await context.supabase
        .from("evidence_wash_assignments")
        .insert({ order_id: data.order_id, washer_id: data.washer_id })
        .select("confirm_token")
        .single();
      if (error) throw new Error(error.message);
      token = ins.confirm_token as string;
    }
    if (!token) throw new Error("Nepodařilo se vygenerovat potvrzovací odkaz.");

    const notify = await loadNotify();
    await notify.enqueueTransactionalEmail({
      templateName: "wash-assignment",
      recipientEmail: washer.email,
      idempotencyKey: `wash-${data.order_id}-${data.washer_id}-${Date.now()}`,
      templateData: {
        recipientName: washer.name ?? "",
        klient: order.klient ?? "",
        vozidlo: order.vozidlo ?? "",
        vis: order.vis ?? "",
        den: fmtDen(order.den),
        hodina: order.hodina ?? "",
        cisloZakazky: order.cislo_zakazky ?? "",
        poznamka: order.poznamka ?? "",
        acceptUrl: `${APP_BASE}/wash-respond/accept/${token}`,
        declineUrl: `${APP_BASE}/wash-respond/decline/${token}`,
      },
    });
    return { ok: true };
  });

export const removeWashAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("evidence_wash_assignments")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ PUBLIC RESPONSE (no auth) ============ */

export const respondToWashAssignment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z
          .string()
          .min(8)
          .max(128)
          .regex(/^[a-zA-Z0-9_-]+$/),
        action: z.enum(["accept", "decline"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("evidence_wash_assignments")
      .select("id, status, order_id, washer_id")
      .eq("confirm_token", data.token)
      .maybeSingle();
    if (!row) {
      return { ok: false as const, reason: "not_found" as const };
    }
    const [{ data: order }, { data: washer }] = await Promise.all([
      supabaseAdmin
        .from("evidence_orders")
        .select("klient, vozidlo, vis, den, hodina, cislo_zakazky")
        .eq("id", row.order_id)
        .maybeSingle(),
      supabaseAdmin.from("washers").select("name").eq("id", row.washer_id).maybeSingle(),
    ]);
    if (row.status !== "pending") {
      return {
        ok: true as const,
        status: row.status,
        alreadyDecided: true as const,
        order,
        washer,
      };
    }
    const newStatus = data.action === "accept" ? "accepted" : "declined";
    await supabaseAdmin
      .from("evidence_wash_assignments")
      .update({ status: newStatus, decided_at: new Date().toISOString() })
      .eq("id", row.id);
    return {
      ok: true as const,
      status: newStatus,
      alreadyDecided: false as const,
      order,
      washer,
    };
  });
