import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEFECT_PRIORITY = ["low", "medium", "high", "critical"] as const;
export const DEFECT_STATUS = ["new", "in_progress", "resolved", "closed"] as const;

export const DEFECT_PRIORITY_LABEL: Record<string, string> = {
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
  critical: "Kritická",
};

export const DEFECT_STATUS_LABEL: Record<string, string> = {
  new: "Nová",
  in_progress: "V řešení",
  resolved: "Vyřešeno",
  closed: "Uzavřeno",
};

const photoSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
});

const createInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  priority: z.enum(DEFECT_PRIORITY).default("medium"),
  photos: z.array(photoSchema).max(10).default([]),
});

const updateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(DEFECT_STATUS).optional(),
  priority: z.enum(DEFECT_PRIORITY).optional(),
  resolution_note: z.string().trim().max(2000).optional().nullable(),
});

export const listDefects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("defects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const createDefect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", userId)
      .maybeSingle();
    const reporter_name = profile?.full_name || profile?.email || null;
    const { data: row, error } = await supabase
      .from("defects")
      .insert({
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        photos: data.photos,
        reported_by: userId,
        reporter_name,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // E-mailová notifikace super adminům o nové závadě
    try {
      const notify = await import("@/lib/email/notify.server");
      await notify.notifyAdmins({
        templateName: "defect-notification",
        idempotencyKey: `defect-reported-${row.id}`,
        templateData: {
          event: "reported",
          title: data.title,
          description: data.description || "",
          reporterName: reporter_name || "",
          priorityLabel: DEFECT_PRIORITY_LABEL[data.priority] ?? data.priority,
          statusLabel: DEFECT_STATUS_LABEL["new"],
          actionUrl: "https://www.autoport-app.cz/zavady",
        },
      });
    } catch (e) {
      console.error("[defects] e-mail o nové závadě selhal", e);
    }
    return { id: row.id };
  });

export const updateDefect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    type UpdatePatch = {
      status?: (typeof DEFECT_STATUS)[number];
      priority?: (typeof DEFECT_PRIORITY)[number];
      resolution_note?: string | null;
      resolved_by?: string | null;
      resolved_at?: string | null;
      resolver_name?: string | null;
    };
    const patch: UpdatePatch = {};
    if (data.priority) patch.priority = data.priority;
    if (data.resolution_note !== undefined) patch.resolution_note = data.resolution_note;
    if (data.status) {
      patch.status = data.status;
      if (data.status === "resolved" || data.status === "closed") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", userId)
          .maybeSingle();
        patch.resolved_by = userId;
        patch.resolved_at = new Date().toISOString();
        patch.resolver_name = profile?.full_name || profile?.email || null;
      } else {
        patch.resolved_by = null;
        patch.resolved_at = null;
        patch.resolver_name = null;
      }
    }
    const { error } = await supabase.from("defects").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.status) {
      const { logEvent } = await import("@/lib/audit.server");
      const { data: defect } = await supabase
        .from("defects")
        .select("title, description, priority, reported_by, reporter_name, resolution_note")
        .eq("id", data.id)
        .maybeSingle();

      // E-mail nahlašovateli o změně stavu jeho závady
      try {
        if (defect?.reported_by && defect.reported_by !== userId) {
          const notify = await import("@/lib/email/notify.server");
          const recipient = await notify.getUserEmail(defect.reported_by);
          if (recipient.email) {
            await notify.enqueueTransactionalEmail({
              templateName: "defect-notification",
              recipientEmail: recipient.email,
              idempotencyKey: `defect-${data.id}-${data.status}`,
              templateData: {
                event: data.status,
                title: defect.title ?? "",
                description: defect.description ?? "",
                recipientName: recipient.name ?? "",
                reporterName: defect.reporter_name ?? "",
                resolverName: patch.resolver_name ?? "",
                priorityLabel:
                  DEFECT_PRIORITY_LABEL[(data.priority ?? defect.priority) as string] ?? "",
                statusLabel: DEFECT_STATUS_LABEL[data.status] ?? data.status,
                resolutionNote: data.resolution_note ?? defect.resolution_note ?? "",
                actionUrl: "https://www.autoport-app.cz/zavady",
              },
            });
          }
        }
      } catch (e) {
        console.error("[defects] e-mail o změně stavu selhal", e);
      }

      await logEvent({
        actorId: userId,
        actorEmail: context.claims?.email ?? null,
        module: "defects",
        action: `status_${data.status}`,
        entityId: data.id,
        entityLabel: defect?.title ?? null,
        details: data.priority ? { priority: data.priority } : undefined,
      });
    }
    return { ok: true };
  });

export const deleteDefect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

export const getDefectPhotoUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ paths: z.array(z.string().min(1).max(500)).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.paths.length) return { urls: {} as Record<string, string> };
    const { data: signed, error } = await context.supabase.storage
      .from("defect-photos")
      .createSignedUrls(data.paths, 60 * 60);
    if (error) throw new Error(error.message);
    const urls: Record<string, string> = {};
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
    });
    return { urls };
  });
