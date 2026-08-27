import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEAL_STAGES = ["lead", "contacted", "offer", "won", "lost"] as const;
export const DEAL_STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  contacted: "Kontaktován",
  offer: "Nabídka",
  won: "Vyhráno",
  lost: "Ztraceno",
};

export const DEAL_VEHICLES = [
  "Citroën C3",
  "Citroën C3 Aircross",
  "Citroën C4",
  "Citroën C5 Aircross",
  "Citroën Berlingo",
  "Citroën Berlingo VU",
  "Citroën SpaceTourer",
  "Citroën Jumpy VU",
  "Citroën Jumper VU",
] as const;

const createInput = z.object({
  title: z.string().trim().min(1).max(200),
  client_name: z.string().trim().max(200).optional().nullable(),
  contact: z.string().trim().max(200).optional().nullable(),
  value_czk: z.number().min(0).max(1_000_000_000).optional().nullable(),
  vehicle: z.string().trim().max(120).optional().nullable(),
  stage: z.enum(DEAL_STAGES).default("lead"),
  expected_close_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  follow_up_at: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/))
    .optional()
    .nullable(),
});

const updateInput = createInput.partial().extend({ id: z.string().uuid() });

const importInput = z.object({
  rows: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        client_name: z.string().trim().max(200).optional().nullable(),
        contact: z.string().trim().max(200).optional().nullable(),
        value_czk: z.number().min(0).max(1_000_000_000).optional().nullable(),
        vehicle: z.string().trim().max(120).optional().nullable(),
        stage: z.enum(DEAL_STAGES).optional(),
        notes: z.string().trim().max(4000).optional().nullable(),
      }),
    )
    .min(1)
    .max(500),
});

export const listDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const listDealStageHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("deal_stage_history" as never)
      .select("id,from_stage,to_stage,changed_at,duration_seconds,changed_by_name")
      .eq("deal_id", data.deal_id)
      .order("changed_at", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []) as Array<{
        id: string;
        from_stage: string | null;
        to_stage: string;
        changed_at: string;
        duration_seconds: number | null;
        changed_by_name: string | null;
      }>,
    };
  });

export const createDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", userId)
      .maybeSingle();
    const owner_name = profile?.full_name || profile?.email || null;
    const { data: row, error } = await supabase
      .from("deals")
      .insert({
        title: data.title,
        client_name: data.client_name || null,
        contact: data.contact || null,
        value_czk: data.value_czk ?? null,
        vehicle: data.vehicle || null,
        stage: data.stage,
        expected_close_date: data.expected_close_date || null,
        notes: data.notes || null,
        follow_up_at: data.follow_up_at || null,
        owner_id: userId,
        owner_name,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { supabase, userId } = context;
    // Snapshot previous state to detect stage changes for notifications
    const { data: prev } = await supabase
      .from("deals")
      .select("stage,stage_changed_at,owner_id,title,vehicle,client_name")
      .eq("id", id)
      .maybeSingle();
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v === "" ? null : v;
    }
    if ("follow_up_at" in patch) patch.follow_up_notified_at = null;
    const { error } = await supabase
      .from("deals")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);

    // Notify owner on stage change
    try {
      if (prev && typeof patch.stage === "string" && patch.stage !== prev.stage && prev.owner_id) {
        const { data: actor } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", userId)
          .maybeSingle();
        const { data: owner } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", prev.owner_id)
          .maybeSingle();
        if (owner?.email) {
          const sinceMs = prev.stage_changed_at
            ? Date.now() - new Date(prev.stage_changed_at).getTime()
            : 0;
          const { enqueueTransactionalEmail } = await import("@/lib/email/notify.server");
          await enqueueTransactionalEmail({
            templateName: "deal-stage-changed",
            recipientEmail: owner.email,
            idempotencyKey: `deal-stage-${id}-${patch.stage}-${Date.now()}`,
            templateData: {
              recipientName: owner.full_name || "",
              actorName: actor?.full_name || actor?.email || "",
              title: prev.title || "",
              vehicle: prev.vehicle || "",
              clientName: prev.client_name || "",
              fromStageLabel: DEAL_STAGE_LABEL[String(prev.stage)] || String(prev.stage),
              toStageLabel: DEAL_STAGE_LABEL[String(patch.stage)] || String(patch.stage),
              durationLabel: formatDuration(sinceMs),
              actionUrl: "https://www.autoport-app.cz/deals",
            },
          });
        }
      }
    } catch (e) {
      console.error("[deals.updateDeal notify]", e);
      return { ok: true, warnings: ["Nebylo možné odeslat e-mailové oznámení o změně fáze."] };
    }

    return { ok: true, warnings: [] as string[] };
  });

export const deleteDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

export const importDeals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", userId)
      .maybeSingle();
    const owner_name = profile?.full_name || profile?.email || null;
    const payload = data.rows.map((r) => ({
      title: r.title,
      client_name: r.client_name || null,
      contact: r.contact || null,
      value_czk: r.value_czk ?? null,
      vehicle: r.vehicle || null,
      stage: r.stage ?? "lead",
      notes: r.notes || null,
      owner_id: userId,
      owner_name,
    }));
    const { error } = await supabase.from("deals").insert(payload as never);
    if (error) throw new Error(error.message);
    return { ok: true, count: payload.length };
  });

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${mins} min`;
  if (mins > 0) return `${mins} min`;
  return `${sec} s`;
}
