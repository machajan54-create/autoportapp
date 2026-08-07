import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const loadNotify = () => import("@/lib/email/notify.server");

const APP_URL = "https://www.autoport-app.cz/approvals";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: any) => r.role === "admin");
}

/** Returns the requester's department head (if any) — used to compute approval scope. */
async function getDeptHeadFor(supabase: any, requesterId: string | null | undefined) {
  if (!requesterId) return null;
  const { data: req } = await supabase
    .from("profiles")
    .select("department")
    .eq("id", requesterId)
    .maybeSingle();
  if (!req?.department) return null;
  const { data: head } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("department", req.department)
    .eq("is_department_head", true)
    .maybeSingle();
  return head ?? null;
}

/** True if the user is a super admin OR the department head of the requester. */
async function canDecideForRequester(
  supabase: any,
  userId: string,
  requesterId: string | null | undefined,
): Promise<boolean> {
  if (await isAdmin(supabase, userId)) return true;
  const head = await getDeptHeadFor(supabase, requesterId);
  return !!head && head.id === userId;
}

/** Returns IDs of users in the same department as the given head (so the head can see their requests). */
async function getDepartmentMemberIds(supabase: any, headUserId: string): Promise<string[]> {
  const { data: me } = await supabase
    .from("profiles")
    .select("department, is_department_head")
    .eq("id", headUserId)
    .maybeSingle();
  if (!me?.is_department_head || !me?.department) return [];
  const { data: members } = await supabase
    .from("profiles")
    .select("id")
    .eq("department", me.department);
  return (members ?? []).map((m: any) => m.id);
}

/**
 * Counts pending items waiting for super-admin decision across the /approvals
 * page (suppliers + purchases). Returns 0 for non-admins.
 */
export const countPendingApprovalItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    if (admin) {
      const [s, p] = await Promise.all([
        context.supabase
          .from("suppliers")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        context.supabase
          .from("purchases")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      return { count: (s.count ?? 0) + (p.count ?? 0) };
    }
    const memberIds = await getDepartmentMemberIds(context.supabase, context.userId);
    if (!memberIds.length) return { count: 0 };
    const [s, p] = await Promise.all([
      context.supabase
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .in("requested_by", memberIds),
      context.supabase
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .in("requested_by", memberIds),
    ]);
    return { count: (s.count ?? 0) + (p.count ?? 0) };
  });

async function attachRequesters<T extends { requested_by?: string | null }>(
  supabase: any,
  rows: T[],
): Promise<
  (T & { requester?: { id: string; full_name: string | null; email: string | null } | null })[]
> {
  const ids = Array.from(new Set(rows.map((r) => r.requested_by).filter(Boolean))) as string[];
  if (!ids.length) return rows.map((r) => ({ ...r, requester: null }));
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  const map = new Map<string, any>((data ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    requester: r.requested_by ? (map.get(r.requested_by) ?? null) : null,
  }));
}

/** Annotate rows with `can_decide` for the current viewer. */
async function annotateDecidable<T extends { requested_by?: string | null }>(
  supabase: any,
  viewerId: string,
  rows: T[],
): Promise<(T & { can_decide: boolean })[]> {
  const admin = await isAdmin(supabase, viewerId);
  if (admin) return rows.map((r) => ({ ...r, can_decide: true }));
  const memberIds = new Set(await getDepartmentMemberIds(supabase, viewerId));
  return rows.map((r) => ({ ...r, can_decide: !!r.requested_by && memberIds.has(r.requested_by) }));
}

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });
    if (!admin) {
      const memberIds = await getDepartmentMemberIds(context.supabase, context.userId);
      const visibleIds = Array.from(new Set([context.userId, ...memberIds]));
      q = q.in("requested_by", visibleIds);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const withReq = await attachRequesters(context.supabase, data ?? []);
    return await annotateDecidable(context.supabase, context.userId, withReq);
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
    const head = await getDeptHeadFor(context.supabase, context.userId);
    const notify = await loadNotify();
    const payload = {
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
    } as const;
    await notify.notifyAdmins(payload);
    if (head && head.email && head.id !== context.userId) {
      await notify.enqueueTransactionalEmail({ ...payload, recipientEmail: head.email });
    }
    return { ok: true };
  });

export const decideSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected", "pending"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase
      .from("suppliers")
      .select("name, requested_by")
      .eq("id", data.id)
      .maybeSingle();
    if (!(await canDecideForRequester(context.supabase, context.userId, row?.requested_by))) {
      throw new Error(
        "Tuto žádost můžete schválit jen jako super admin nebo vedoucí oddělení žadatele.",
      );
    }
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
        await (
          await loadNotify()
        ).enqueueTransactionalEmail({
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
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("purchases")
      .select("*, supplier:suppliers(id,name)")
      .order("created_at", { ascending: false });
    if (!admin) {
      const memberIds = await getDepartmentMemberIds(context.supabase, context.userId);
      const visibleIds = Array.from(new Set([context.userId, ...memberIds]));
      q = q.in("requested_by", visibleIds);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const withReq = await attachRequesters(context.supabase, data ?? []);
    return await annotateDecidable(context.supabase, context.userId, withReq);
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
    const head = await getDeptHeadFor(context.supabase, context.userId);
    const notify = await loadNotify();
    const payload = {
      templateName: "approval-request",
      templateData: {
        kind: "purchase",
        requesterName: me.name ?? me.email ?? "Uživatel",
        title: data.title,
        details: data.description ?? "",
        meta: [
          ...(data.amount != null
            ? [
                {
                  label: "Částka",
                  value: `${Number(data.amount).toLocaleString("cs-CZ")} ${data.currency}`,
                },
              ]
            : []),
        ],
        actionUrl: APP_URL,
      },
    } as const;
    await notify.notifyAdmins(payload);
    if (head && head.email && head.id !== context.userId) {
      await notify.enqueueTransactionalEmail({ ...payload, recipientEmail: head.email });
    }
    return { ok: true };
  });

export const decidePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected", "pending"]),
        decision_note: z.string().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase
      .from("purchases")
      .select("title, amount, currency, requested_by")
      .eq("id", data.id)
      .maybeSingle();
    if (!(await canDecideForRequester(context.supabase, context.userId, row?.requested_by))) {
      throw new Error(
        "Tuto žádost můžete schválit jen jako super admin nebo vedoucí oddělení žadatele.",
      );
    }
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
        await (
          await loadNotify()
        ).enqueueTransactionalEmail({
          templateName: "approval-decision",
          recipientEmail: u.email,
          idempotencyKey: `purchase-${data.id}-${data.status}`,
          templateData: {
            kind: "purchase",
            status: data.status,
            recipientName: u.name ?? "",
            title: row.title,
            note: data.decision_note ?? "",
            meta:
              row.amount != null
                ? [
                    {
                      label: "Částka",
                      value: `${Number(row.amount).toLocaleString("cs-CZ")} ${row.currency}`,
                    },
                  ]
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
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });
