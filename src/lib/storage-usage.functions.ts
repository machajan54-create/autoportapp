import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DB_LIMIT_BYTES, usageLevel } from "@/lib/storage-usage";

export const getStorageUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_storage_usage");
    if (error) throw new Error("Nepodařilo se načíst využití databáze.");
    const row = (Array.isArray(data) ? data[0] : data) as { db_bytes: number; files_bytes: number };
    const dbBytes = Number(row?.db_bytes ?? 0);
    const pct = Math.round((dbBytes / DB_LIMIT_BYTES) * 100);
    return {
      dbBytes,
      filesBytes: Number(row?.files_bytes ?? 0),
      limitBytes: DB_LIMIT_BYTES,
      pct,
      level: usageLevel(pct),
    };
  });
