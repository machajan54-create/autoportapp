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

const createInput = z.object({
  title: z.string().trim().min(1).max(200),
  client_name: z.string().trim().max(200).optional().nullable(),
  contact: z.string().trim().max(200).optional().nullable(),
  value_czk: z.number().min(0).max(1_000_000_000).optional().nullable(),
  stage: z.enum(DEAL_STAGES).default("lead"),
  expected_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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
  rows: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    client_name: z.string().trim().max(200).optional().nullable(),
    contact: z.string().trim().max(200).optional().nullable(),
    value_czk: z.number().min(0).max(1_000_000_000).optional().nullable(),
    stage: z.enum(DEAL_STAGES).optional(),
    notes: z.string().trim().max(4000).optional().nullable(),
  })).min(1).max(500),
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

export const createDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("full_name,email").eq("id", userId).maybeSingle();
    const owner_name = profile?.full_name || profile?.email || null;
    const { data: row, error } = await supabase
      .from("deals")
      .insert({
        title: data.title,
        client_name: data.client_name || null,
        contact: data.contact || null,
        value_czk: data.value_czk ?? null,
        stage: data.stage,
        expected_close_date: data.expected_close_date || null,
        notes: data.notes || null,
      follow_up_at: data.follow_up_at || null,
        owner_id: userId,
        owner_name,
      })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v === "" ? null : v;
    }
    if ("follow_up_at" in patch) patch.follow_up_notified_at = null;
    const { error } = await context.supabase
      .from("deals")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("deals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importDeals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("full_name,email").eq("id", userId).maybeSingle();
    const owner_name = profile?.full_name || profile?.email || null;
    const payload = data.rows.map((r) => ({
      title: r.title,
      client_name: r.client_name || null,
      contact: r.contact || null,
      value_czk: r.value_czk ?? null,
      stage: r.stage ?? "lead",
      notes: r.notes || null,
      owner_id: userId,
      owner_name,
    }));
    const { error } = await supabase.from("deals").insert(payload as never);
    if (error) throw new Error(error.message);
    return { ok: true, count: payload.length };
  });