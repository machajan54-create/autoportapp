import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const loadNotify = () => import("@/lib/email/notify.server");

const APP_URL = "https://www.autoport-app.cz/approvals";

/**
 * Whitelist of tables a user may request to delete.
 * Each entry describes how to derive a human label from a row.
 * `select` is the comma-separated column list passed to PostgREST.
 * `label(row)` produces a snapshot string stored in the request.
 */
const ENTITY_REGISTRY: Record<
  string,
  {
    table: string;
    select: string;
    label: (row: any) => string;
    typeLabel: string;
  }
> = {
  demo_orders: {
    table: "demo_orders",
    select: "order_number, customer_name",
    label: (r) => `Objednávka ${r?.order_number ?? ""} / ${r?.customer_name ?? ""}`.trim(),
    typeLabel: "Předváděcí vůz – objednávka",
  },
  tasks: {
    table: "tasks",
    select: "title",
    label: (r) => `Úkol: ${r?.title ?? ""}`,
    typeLabel: "Úkol",
  },
  deals: {
    table: "deals",
    select: "title",
    label: (r) => `Obchod: ${r?.title ?? ""}`,
    typeLabel: "Obchod",
  },
  claims: {
    table: "claims",
    select: "pu_number, first_name, last_name, insurer",
    label: (r) => {
      const owner = [r?.first_name, r?.last_name].filter(Boolean).join(" ").trim();
      const parts = [r?.pu_number, r?.insurer, owner].filter(Boolean);
      return `Zakázka ${parts.join(" – ")}`.trim();
    },
    typeLabel: "Reklamace / zakázka",
  },
  defects: {
    table: "defects",
    select: "title",
    label: (r) => `Vada: ${r?.title ?? ""}`,
    typeLabel: "Vada",
  },
  vykupy: {
    table: "vykupy",
    select: "spz, vin, customer_name",
    label: (r) => `Výkup ${r?.spz ?? r?.vin ?? ""} / ${r?.customer_name ?? ""}`.trim(),
    typeLabel: "Výkup",
  },
  vykup_photos: {
    table: "vykup_photos",
    select: "file_name",
    label: (r) => `Fotka výkupu: ${r?.file_name ?? ""}`,
    typeLabel: "Fotka výkupu",
  },
  logbook_vehicles: {
    table: "logbook_vehicles",
    select: "name, spz",
    label: (r) => `Vozidlo: ${r?.name ?? ""} (${r?.spz ?? ""})`,
    typeLabel: "Kniha jízd – vozidlo",
  },
  logbook_entries: {
    table: "logbook_entries",
    select: "date_from, purpose",
    label: (r) => `Jízda ${r?.date_from ?? ""} – ${r?.purpose ?? ""}`,
    typeLabel: "Kniha jízd – záznam",
  },
  clients: {
    table: "clients",
    select: "name",
    label: (r) => `Klient: ${r?.name ?? ""}`,
    typeLabel: "Klient",
  },
  suppliers: {
    table: "suppliers",
    select: "name",
    label: (r) => `Dodavatel: ${r?.name ?? ""}`,
    typeLabel: "Dodavatel",
  },
  purchases: {
    table: "purchases",
    select: "title",
    label: (r) => `Nákup: ${r?.title ?? ""}`,
    typeLabel: "Nákup",
  },
  attendance_records: {
    table: "attendance_records",
    select: "date, employee_id",
    label: (r) => `Docházka ${r?.date ?? ""}`,
    typeLabel: "Záznam docházky",
  },
  attendance_shifts: {
    table: "attendance_shifts",
    select: "name",
    label: (r) => `Směna: ${r?.name ?? ""}`,
    typeLabel: "Směna",
  },
  attendance_absences: {
    table: "attendance_absences",
    select: "kind, date_from",
    label: (r) => `Absence ${r?.kind ?? ""} od ${r?.date_from ?? ""}`,
    typeLabel: "Absence",
  },
  attendance_employees: {
    table: "attendance_employees",
    select: "name",
    label: (r) => `Zaměstnanec: ${r?.name ?? ""}`,
    typeLabel: "Zaměstnanec docházky",
  },
  task_comments: {
    table: "task_comments",
    select: "body",
    label: (r) => `Komentář: ${(r?.body ?? "").slice(0, 80)}`,
    typeLabel: "Komentář úkolu",
  },
  task_attachments: {
    table: "task_attachments",
    select: "file_name",
    label: (r) => `Příloha: ${r?.file_name ?? ""}`,
    typeLabel: "Příloha úkolu",
  },
  claim_attachments: {
    table: "claim_attachments",
    select: "file_name",
    label: (r) => `Příloha zakázky: ${r?.file_name ?? ""}`,
    typeLabel: "Příloha zakázky",
  },
};

const ENTITY_TYPES = Object.keys(ENTITY_REGISTRY) as [string, ...string[]];

export const ENTITY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ENTITY_REGISTRY).map(([k, v]) => [k, v.typeLabel]),
);

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: any) => r.role === "admin");
}

async function assertAdmin(supabase: any, userId: string) {
  if (!(await isAdmin(supabase, userId))) {
    throw new Error("Tuto akci může provést pouze super admin.");
  }
}

/**
 * Collect storage objects that must be removed when a record (and its cascade
 * children) is deleted. We must collect paths BEFORE the DB delete, because
 * ON DELETE CASCADE removes the child rows that hold the paths.
 * Returns groups by bucket.
 */
async function collectStoragePaths(
  db: any,
  entityType: string,
  entityId: string,
): Promise<Array<{ bucket: string; paths: string[] }>> {
  const out: Array<{ bucket: string; paths: string[] }> = [];
  const push = (bucket: string, paths: Array<string | null | undefined>) => {
    const cleaned = paths.filter((p): p is string => !!p);
    if (cleaned.length) out.push({ bucket, paths: cleaned });
  };

  switch (entityType) {
    case "claim_attachments": {
      const { data } = await db
        .from("claim_attachments").select("file_path").eq("id", entityId).maybeSingle();
      push("claim-files", [data?.file_path]);
      break;
    }
    case "claims": {
      const { data } = await db
        .from("claim_attachments").select("file_path").eq("claim_id", entityId);
      push("claim-files", (data ?? []).map((r: any) => r.file_path));
      break;
    }
    case "task_attachments": {
      const { data } = await db
        .from("task_attachments").select("storage_path").eq("id", entityId).maybeSingle();
      push("task-attachments", [data?.storage_path]);
      break;
    }
    case "tasks": {
      const { data } = await db
        .from("task_attachments").select("storage_path").eq("task_id", entityId);
      push("task-attachments", (data ?? []).map((r: any) => r.storage_path));
      break;
    }
    case "vykup_photos": {
      const { data } = await db
        .from("vykup_photos").select("storage_path").eq("id", entityId).maybeSingle();
      push("vykup-photos", [data?.storage_path]);
      break;
    }
    case "vykupy": {
      const { data } = await db
        .from("vykup_photos").select("storage_path").eq("vykup_id", entityId);
      push("vykup-photos", (data ?? []).map((r: any) => r.storage_path));
      break;
    }
    case "logbook_entries": {
      const { data } = await db
        .from("logbook_entries").select("receipt_path").eq("id", entityId).maybeSingle();
      push("logbook-receipts", [data?.receipt_path]);
      break;
    }
    case "logbook_vehicles": {
      const { data } = await db
        .from("logbook_entries").select("receipt_path").eq("vehicle_id", entityId);
      push("logbook-receipts", (data ?? []).map((r: any) => r.receipt_path));
      break;
    }
    case "demo_orders": {
      const { data } = await db
        .from("demo_order_documents").select("storage_path").eq("order_id", entityId);
      push("client-documents", (data ?? []).map((r: any) => r.storage_path));
      break;
    }
    case "defects": {
      // Photos live in JSONB column `photos: [{ path, ... }]` on the row itself
      const { data } = await db
        .from("defects").select("photos").eq("id", entityId).maybeSingle();
      const paths = Array.isArray(data?.photos)
        ? (data.photos as any[]).map((p) => p?.path).filter(Boolean)
        : [];
      push("defect-photos", paths);
      break;
    }
    default:
      break;
  }
  return out;
}

async function removeStorageObjects(
  supabaseAdmin: any,
  groups: Array<{ bucket: string; paths: string[] }>,
) {
  for (const g of groups) {
    if (!g.paths.length) continue;
    try {
      await supabaseAdmin.storage.from(g.bucket).remove(g.paths);
    } catch {
      // Best-effort cleanup; DB row is already gone, log but don't fail.
    }
  }
}

const requestInput = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.string().uuid(),
  reason: z.string().min(3, "Uveďte důvod (alespoň 3 znaky)").max(1000),
});

export const requestDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => requestInput.parse(d))
  .handler(async ({ context, data }) => {
    const reg = ENTITY_REGISTRY[data.entity_type];
    if (!reg) throw new Error("Neznámý typ záznamu");

    // Resolve label via the user's authed client. The service-role key in
    // Lovable Cloud is `sb_secret_…` format which the Data API rejects, so
    // we keep `supabaseAdmin` only for Storage cleanup below.
    const { data: row, error: lookupErr } = await (context.supabase as any)
      .from(reg.table)
      .select(reg.select)
      .eq("id", data.entity_id)
      .maybeSingle();
    if (lookupErr) {
      console.error("[requestDeletion lookup]", reg.table, lookupErr);
      throw new Error(`Nepodařilo se ověřit záznam: ${lookupErr.message}`);
    }
    if (!row) {
      // Record already gone (e.g. cascade-deleted). Nothing to approve.
      return { ok: true, alreadyGone: true as const };
    }
    const entity_label = reg.label(row) || `${reg.typeLabel} #${data.entity_id.slice(0, 8)}`;

    // Super admin bypasses the approval queue and deletes immediately.
    if (await isAdmin(context.supabase, context.userId)) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const storageGroups = await collectStoragePaths(
        context.supabase,
        data.entity_type,
        data.entity_id,
      );
      const { error: delErr } = await (context.supabase as any)
        .from(reg.table)
        .delete()
        .eq("id", data.entity_id);
      if (delErr) throw new Error(`Smazání selhalo: ${delErr.message}`);
      await removeStorageObjects(supabaseAdmin, storageGroups);
      const nowIso = new Date().toISOString();
      await (context.supabase as any).from("deletion_requests").insert({
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        entity_label,
        reason: data.reason,
        requested_by: context.userId,
        status: "approved",
        decided_by: context.userId,
        decided_at: nowIso,
        decision_note: "Smazáno přímo super adminem",
      });
      return { ok: true, autoApproved: true as const };
    }

    const { error } = await context.supabase.from("deletion_requests" as any).insert({
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      entity_label,
      reason: data.reason,
      requested_by: context.userId,
      status: "pending",
    });
    if (error) {
      if ((error as any).code === "23505") {
        throw new Error("Pro tento záznam už existuje čekající žádost o smazání.");
      }
      throw new Error(error.message);
    }

    const me = await (await loadNotify()).getUserEmail(context.userId);
    await (await loadNotify()).notifyAdmins({
      templateName: "approval-request",
      templateData: {
        kind: "deletion",
        requesterName: me.name ?? me.email ?? "Uživatel",
        title: `Žádost o smazání: ${entity_label}`,
        details: data.reason,
        meta: [{ label: "Typ záznamu", value: reg.typeLabel }],
        actionUrl: APP_URL,
      },
    });
    return { ok: true };
  });

export const listDeletionRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("deletion_requests" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!admin) q = q.eq("requested_by", context.userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];

    const ids = Array.from(
      new Set(
        rows.flatMap((r) => [r.requested_by, r.decided_by]).filter(Boolean),
      ),
    ) as string[];
    const profMap = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      (profs ?? []).forEach((p: any) => profMap.set(p.id, p));
    }
    return rows.map((r) => ({
      ...r,
      type_label: ENTITY_TYPE_LABELS[r.entity_type] ?? r.entity_type,
      requester: profMap.get(r.requested_by) ?? null,
      decider: r.decided_by ? profMap.get(r.decided_by) ?? null : null,
    }));
  });

export const countPendingDeletionRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    if (!admin) return { count: 0 };
    const { count } = await context.supabase
      .from("deletion_requests" as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    return { count: count ?? 0 };
  });

export const cancelDeletionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("deletion_requests" as any)
      .delete()
      .eq("id", data.id)
      .eq("requested_by", context.userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideDeletionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      decision_note: z.string().max(1000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: req, error: reqErr } = await context.supabase
      .from("deletion_requests" as any)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Žádost nenalezena.");
    if ((req as any).status !== "pending") {
      throw new Error("Žádost už byla rozhodnuta.");
    }

    const reg = ENTITY_REGISTRY[(req as any).entity_type];
    if (!reg) throw new Error("Neznámý typ záznamu.");

    if (data.status === "approved") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Snapshot file paths BEFORE delete so we can clean up storage afterwards.
      const storageGroups = await collectStoragePaths(
        context.supabase,
        (req as any).entity_type,
        (req as any).entity_id,
      );
      const { error: delErr } = await (context.supabase as any)
        .from(reg.table)
        .delete()
        .eq("id", (req as any).entity_id);
      if (delErr) {
        throw new Error(`Smazání selhalo: ${delErr.message}`);
      }
      await removeStorageObjects(supabaseAdmin, storageGroups);
    }

    const { error: updErr } = await context.supabase
      .from("deletion_requests" as any)
      .update({
        status: data.status,
        decision_note: data.decision_note ?? null,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    const requesterId = (req as any).requested_by as string | null;
    if (requesterId) {
      const u = await (await loadNotify()).getUserEmail(requesterId);
      if (u.email) {
        await (await loadNotify()).enqueueTransactionalEmail({
          templateName: "approval-decision",
          recipientEmail: u.email,
          idempotencyKey: `deletion-${data.id}-${data.status}`,
          templateData: {
            kind: "deletion",
            status: data.status,
            recipientName: u.name ?? "",
            title: `Žádost o smazání: ${(req as any).entity_label}`,
            note: data.decision_note ?? "",
            actionUrl: APP_URL,
          },
        });
      }
    }
    return { ok: true };
  });