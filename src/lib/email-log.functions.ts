import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listInput = z
  .object({
    status: z.string().max(30).optional().nullable(),
    search: z.string().max(200).optional().nullable(),
    template: z.string().max(100).optional().nullable(),
    limit: z.number().int().min(1).max(500).default(200),
  })
  .default({ limit: 200 });

export interface EmailDeliveryRow {
  id: string;
  created_at: string;
  recipient_email: string;
  template_name: string;
  status: string;
  error_message: string | null;
  message_id: string | null;
}

/** Delivery log recorded by the app for every outgoing e-mail. */
export const listEmailDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    let q = supabase
      .from("email_send_log")
      .select("id, created_at, recipient_email, template_name, status, error_message, message_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status) q = q.eq("status", data.status);
    if (data.template) q = q.eq("template_name", data.template);
    if (data.search) q = q.ilike("recipient_email", `%${data.search}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Stats over the last 30 days, independent of the active filters.
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: statRows, error: statError } = await supabase
      .from("email_send_log")
      .select("status, template_name")
      .gte("created_at", since)
      .limit(5000);
    if (statError) throw new Error(statError.message);

    const counts: Record<string, number> = {};
    const templates = new Set<string>();
    (statRows ?? []).forEach((r: any) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      if (r.template_name) templates.add(r.template_name);
    });

    return {
      rows: (rows ?? []) as EmailDeliveryRow[],
      counts,
      total: (statRows ?? []).length,
      templates: [...templates].sort(),
    };
  });

const platformInput = z
  .object({
    recipient: z.string().max(200).optional().nullable(),
    event_type: z.string().max(30).optional().nullable(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .default({ limit: 50 });

/** Delivery events reported by the e-mail platform (sent, rejected, bounced, ...). */
export const listPlatformEmailEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => platformInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { events: [], historyStartsAt: null, error: "Odesílání e-mailů není nakonfigurováno." };

    const { listEmailLogs } = await import("@lovable.dev/email-js");
    try {
      const res = await listEmailLogs(
        {
          limit: data.limit,
          ...(data.recipient ? { recipient: data.recipient } : {}),
          ...(data.event_type ? { event_type: data.event_type } : {}),
        },
        { apiKey },
      );
      return {
        events: res.data.map((e) => ({
          timestamp: e.timestamp,
          recipient: e.recipient,
          event_type: e.event_type,
          status: e.status ?? null,
        })),
        historyStartsAt: res.history_starts_at ?? null,
        error: null as string | null,
      };
    } catch (e: any) {
      return { events: [], historyStartsAt: null, error: e?.message ?? "Nepodařilo se načíst události." };
    }
  });
