import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface LogEventArgs {
  actorId: string | null;
  actorEmail?: string | null;
  module: string;
  action: string;
  entityId?: string | null;
  entityLabel?: string | null;
  details?: Record<string, any>;
}

/**
 * Server-only helper to write into the audit log.
 * Never throws — audit failures must not break the calling action.
 */
export async function logEvent(args: LogEventArgs): Promise<void> {
  try {
    await supabaseAdmin.from("audit_log").insert({
      actor_id: args.actorId,
      actor_email: args.actorEmail ?? null,
      module: args.module,
      action: args.action,
      entity_id: args.entityId ?? null,
      entity_label: args.entityLabel ?? null,
      details: args.details ?? null,
    });
  } catch (e: any) {
    console.error("[audit] failed", e?.message ?? e);
  }
}
