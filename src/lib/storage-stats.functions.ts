import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKETS = [
  "defect-photos",
  "vykup-photos",
  "logbook-receipts",
  "task-attachments",
  "claim-files",
  "client-documents",
] as const;

const IMAGE_RE = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;

type FileRow = {
  bucket: string;
  name: string;
  size: number;
  created_at: string;
  is_image: boolean;
};

export const getStorageSavings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows: FileRow[] = [];

    async function walk(bucket: string, prefix: string) {
      let offset = 0;
      const limit = 1000;
      while (true) {
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
        if (error) return;
        if (!data || data.length === 0) break;
        for (const item of data) {
          const path = prefix ? `${prefix}/${item.name}` : item.name;
          const meta = item.metadata as { size?: number } | null;
          const size = meta?.size ?? 0;
          if (item.id === null || size === 0) {
            // folder
            await walk(bucket, path);
          } else {
            rows.push({
              bucket,
              name: path,
              size,
              created_at: item.created_at ?? new Date().toISOString(),
              is_image: IMAGE_RE.test(item.name),
            });
          }
        }
        if (data.length < limit) break;
        offset += limit;
      }
    }

    for (const b of BUCKETS) {
      await walk(b, "");
    }

    return { rows, buckets: [...BUCKETS] as string[] };
  });