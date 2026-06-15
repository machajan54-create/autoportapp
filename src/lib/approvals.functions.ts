import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const loadNotify = () => import("@/lib/email/notify.server");

const APP_URL = "https://www.autoport-app.cz/approvals";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Error("Pouze super admin");
  }
}

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: any) => r.role === "admin");
}

async function attachRequesters<T extends { requested_by?: string | null }>(
  supabase: any,
  rows: T[],
): Promise<(T & { requester?: { id: string; full_name: string | null; email: string | null } | null })[]> {
  const ids = Array.from(new Set(rows.map((r) => r.requested_by).filter(Boolean))) as string[];
  if (!ids.length) return rows.map((r) => ({ ...r, requester: null }));
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  const map = new Map<string, any>((data ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ ...r, requester: r.requested_by ? map.get(r.requested_by) ?? null : null }));
}

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    let q = context.supabase.from("suppliers").select("*").order("created_at", { ascending: false });
    if (!admin) q = q.eq("requested_by", context.userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return await attachRequesters(context.supabase, data ?? []);
  });

const supplierInput = z.object({
  name: z.string().min(1).max(255),
  ico: z.string().max(20).optional().nullable(),
  dic: z.string().max(20).optional().nullable(),
  contact_person: z.string().max(255).optional().nullable(),
  email: z.string().email().max(255).optional().or(z.literal("")).nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const createSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => supplierInput.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("suppliers").insert({
      ...data,
      email: data.email || null,
      status: "pending",
      requested_by: context.userId,
    });
    if (error) throw new Error(error.message);
    const me = await (await loadNotify()).getUserEmail(context.userId);
    await (await loadNotify()).notifyAdmins({
      templateName: "approval-request",
      templateData: {
        kind: "purchase",
        requesterName: me.name ?? me.email ?? "Uživatel",
        title: `Nový dodavatel: ${data.name}`,
        details: data.notes ?? "",
        meta: [
          ...(data.ico ? [{ label: "IČO", value: data.ico }] : []),
          ...(data.contact_person ? [{ label: "Kontakt", value: data.contact_person }] : []),
          ...(data.email ? [{ label: "E-mail", value: data.email as string }] : []),
        ],
        actionUrl: APP_URL,
      },
    });
    return { ok: true };
  });

export const decideSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected", "pending"]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("suppliers")
      .select("name, requested_by")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("suppliers")
      .update({
        status: data.status,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.requested_by && data.status !== "pending") {
      const u = await (await loadNotify()).getUserEmail(row.requested_by);
      if (u.email) {
        await (await loadNotify()).enqueueTransactionalEmail({
          templateName: "approval-decision",
          recipientEmail: u.email,
          idempotencyKey: `supplier-${data.id}-${data.status}`,
          templateData: {
            kind: "purchase",
            status: data.status,
            recipientName: u.name ?? "",
            title: `Dodavatel: ${row.name}`,
            actionUrl: APP_URL,
          },
        });
      }
    }
    return { ok: true };
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("suppliers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("purchases")
      .select("*, supplier:suppliers(id,name)")
      .order("created_at", { ascending: false });
    if (!admin) q = q.eq("requested_by", context.userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return await attachRequesters(context.supabase, data ?? []);
  });

const purchaseInput = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  amount: z.number().min(0).max(1_000_000_000).optional().nullable(),
  amount_net: z.number().min(0).max(1_000_000_000).optional().nullable(),
  vat_rate: z.number().min(0).max(100).optional().default(21),
  currency: z.string().min(1).max(10).default("CZK"),
});

export const createPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => purchaseInput.parse(d))
  .handler(async ({ context, data }) => {
    const vat = data.vat_rate ?? 21;
    let amount = data.amount;
    let amountNet = data.amount_net;
    if (amount == null && amountNet != null) {
      amount = Math.round(amountNet * (1 + vat / 100) * 100) / 100;
    } else if (amountNet == null && amount != null) {
      amountNet = Math.round((amount / (1 + vat / 100)) * 100) / 100;
    }
    const { error } = await context.supabase.from("purchases").insert({
      title: data.title,
      description: data.description,
      supplier_id: data.supplier_id,
      currency: data.currency,
      amount,
      amount_net: amountNet,
      vat_rate: vat,
      status: "pending",
      requested_by: context.userId,
    });
    if (error) throw new Error(error.message);
    const me = await (await loadNotify()).getUserEmail(context.userId);
    await (await loadNotify()).notifyAdmins({
      templateName: "approval-request",
      templateData: {
        kind: "purchase",
        requesterName: me.name ?? me.email ?? "Uživatel",
        title: data.title,
        details: data.description ?? "",
        meta: [
          ...(data.amount != null
            ? [{ label: "Částka", value: `${Number(data.amount).toLocaleString("cs-CZ")} ${data.currency}` }]
            : []),
        ],
        actionUrl: APP_URL,
      },
    });
    return { ok: true };
  });

export const decidePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected", "pending"]),
      decision_note: z.string().max(1000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("purchases")
      .select("title, amount, currency, requested_by")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("purchases")
      .update({
        status: data.status,
        decision_note: data.decision_note ?? null,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.requested_by && data.status !== "pending") {
      const u = await (await loadNotify()).getUserEmail(row.requested_by);
      if (u.email) {
        await (await loadNotify()).enqueueTransactionalEmail({
          templateName: "approval-decision",
          recipientEmail: u.email,
          idempotencyKey: `purchase-${data.id}-${data.status}`,
          templateData: {
            kind: "purchase",
            status: data.status,
            recipientName: u.name ?? "",
            title: row.title,
            note: data.decision_note ?? "",
            meta: row.amount != null
              ? [{ label: "Částka", value: `${Number(row.amount).toLocaleString("cs-CZ")} ${row.currency}` }]
              : [],
            actionUrl: APP_URL,
          },
        });
      }
    }
    return { ok: true };
  });

export const deletePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("purchases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });