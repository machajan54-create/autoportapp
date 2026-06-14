import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const vehicleInput = z.object({
  id: z.string().uuid().optional(),
  type: z.string().trim().min(1).max(120),
  spz: z.string().trim().max(20).optional().nullable(),
  body_number: z.string().trim().max(40).optional().nullable(),
  responsible_person: z.string().trim().max(160).optional().nullable(),
  active: z.boolean().optional(),
});

const entryInput = z.object({
  id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  route: z.string().trim().max(300).optional().nullable(),
  purpose: z.string().trim().max(200).optional().nullable(),
  km_driven: z.number().min(0).max(100000).optional().nullable(),
  odometer: z.number().min(0).max(10000000).optional().nullable(),
  fuel_liters: z.number().min(0).max(10000).optional().nullable(),
  fuel_cost_czk: z.number().min(0).max(1_000_000).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("logbook_vehicles")
      .select("*")
      .order("active", { ascending: false })
      .order("type", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const upsertVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => vehicleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const payload = {
      type: rest.type,
      spz: rest.spz || null,
      body_number: rest.body_number || null,
      responsible_person: rest.responsible_person || null,
      active: rest.active ?? true,
    };
    if (id) {
      const { error } = await context.supabase
        .from("logbook_vehicles").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("logbook_vehicles")
      .insert({ ...payload, created_by: context.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("logbook_vehicles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vehicle_id: z.string().uuid().optional() }).partial().parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("logbook_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    if (data?.vehicle_id) q = q.eq("vehicle_id", data.vehicle_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const upsertEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => entryInput.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const payload = {
      vehicle_id: rest.vehicle_id,
      entry_date: rest.entry_date,
      route: rest.route || null,
      purpose: rest.purpose || null,
      km_driven: rest.km_driven ?? null,
      odometer: rest.odometer ?? null,
      fuel_liters: rest.fuel_liters ?? null,
      fuel_cost_czk: rest.fuel_cost_czk ?? null,
      note: rest.note || null,
    };
    if (id) {
      const { error } = await context.supabase
        .from("logbook_entries").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: profile } = await context.supabase
      .from("profiles").select("full_name,email").eq("id", context.userId).maybeSingle();
    const created_by_name = profile?.full_name || profile?.email || null;
    const { data: row, error } = await context.supabase
      .from("logbook_entries")
      .insert({ ...payload, created_by: context.userId, created_by_name })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("logbook_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });