import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const clientInput = z.object({
  full_name: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional().nullable(),
  ico: z.string().trim().max(20).optional().nullable(),
  dic: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clients" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as any[] };
  });

export const getClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("clients" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Klient nenalezen");
    const { data: orders } = await context.supabase
      .from("demo_orders" as never)
      .select("id,order_number,model_verze,status,cena_celkem_s_dph,created_at")
      .eq("client_id", data.id)
      .order("created_at", { ascending: false });
    const { data: docs } = await context.supabase
      .from("demo_order_documents" as never)
      .select("id,order_id,kind,file_name,storage_path,signed_at,created_at")
      .eq("client_id", data.id)
      .order("created_at", { ascending: false });
    return { client: row as any, orders: (orders ?? []) as any[], documents: (docs ?? []) as any[] };
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clientInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, email: data.email || null, owner_id: context.userId };
    const { data: row, error } = await context.supabase
      .from("clients" as never)
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id as string };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clientInput.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data as any;
    if ("email" in rest && rest.email === "") rest.email = null;
    const { error } = await context.supabase
      .from("clients" as never)
      .update(rest as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clients" as never).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });