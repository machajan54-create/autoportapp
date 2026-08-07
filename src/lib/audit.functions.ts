import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listInput = z
  .object({
    module: z.string().max(50).optional().nullable(),
    actor_id: z.string().uuid().optional().nullable(),
    search: z.string().max(200).optional().nullable(),
    from: z.string().optional().nullable(),
    to: z.string().optional().nullable(),
    limit: z.number().int().min(1).max(500).default(200),
  })
  .default({ limit: 200 });

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    let q = supabase
      .from("audit_log")
      .select(
        "id, actor_id, actor_email, module, action, entity_id, entity_label, details, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.module) q = q.eq("module", data.module);
    if (data.actor_id) q = q.eq("actor_id", data.actor_id);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`entity_label.ilike.${s},actor_email.ilike.${s},action.ilike.${s}`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const listAuditModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await supabase.from("audit_log").select("module").limit(1000);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    (data ?? []).forEach((r: any) => r.module && set.add(r.module));
    return { modules: [...set].sort() };
  });
