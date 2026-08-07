import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/cron/backup")({
  server: { handlers: { POST: handle, GET: handle } },
});

async function handle({ request }: { request: Request }) {
  const unauthorized = await requireCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("backup_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();

    const { isBackupDue, performBackup } = await import("@/lib/backup-core.server");

    if (!settings?.auto_backup_enabled) {
      return Response.json({ ok: true, skipped: "auto_disabled" });
    }
    if (!settings.drive_folder_id) {
      return Response.json({ ok: false, error: "Chybí cílová složka na Disku." }, { status: 400 });
    }
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    if (!force && !isBackupDue(settings)) {
      return Response.json({ ok: true, skipped: "not_due" });
    }

    const result = await performBackup({ trigger: "scheduled", startedBy: null });
    return Response.json(result);
  } catch (e: any) {
    console.error("[cron backup]", e?.message ?? e);
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
