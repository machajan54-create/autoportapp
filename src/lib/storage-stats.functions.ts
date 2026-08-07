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

    // Total across ALL buckets in the project (not just image ones)
    const { data: allBuckets } = await supabaseAdmin.storage.listBuckets();
    const totalsByBucket: { bucket: string; size: number; count: number }[] = [];
    let grandTotalSize = 0;
    let grandTotalCount = 0;

    async function measure(
      bucket: string,
      prefix: string,
    ): Promise<{ size: number; count: number }> {
      let size = 0;
      let count = 0;
      let offset = 0;
      const limit = 1000;
      while (true) {
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
        if (error) return { size, count };
        if (!data || data.length === 0) break;
        for (const item of data) {
          const path = prefix ? `${prefix}/${item.name}` : item.name;
          const meta = item.metadata as { size?: number } | null;
          const s = meta?.size ?? 0;
          if (item.id === null || s === 0) {
            const sub = await measure(bucket, path);
            size += sub.size;
            count += sub.count;
          } else {
            size += s;
            count += 1;
          }
        }
        if (data.length < limit) break;
        offset += limit;
      }
      return { size, count };
    }

    for (const b of allBuckets ?? []) {
      const { size, count } = await measure(b.name, "");
      totalsByBucket.push({ bucket: b.name, size, count });
      grandTotalSize += size;
      grandTotalCount += count;
    }

    return {
      rows,
      buckets: [...BUCKETS] as string[],
      totals: { size: grandTotalSize, count: grandTotalCount, byBucket: totalsByBucket },
    };
  });
