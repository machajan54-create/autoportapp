import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/cron/github-snapshot")({
  server: { handlers: { POST: handle, GET: handle } },
});

async function handle({ request }: { request: Request }) {
  const unauthorized = await requireCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("backup_settings")
      .select("github_auto_enabled, github_owner, github_repo, drive_folder_id")
      .eq("singleton", true)
      .maybeSingle();

    if (!settings?.github_auto_enabled) {
      return Response.json({ ok: true, skipped: "auto_disabled" });
    }
    if (!settings.github_owner || !settings.github_repo || !settings.drive_folder_id) {
      return Response.json({ ok: false, error: "Chybí GitHub repo nebo cílová složka." }, { status: 400 });
    }

    const { performGithubSnapshot } = await import("@/lib/github-snapshot.functions");
    const result = await performGithubSnapshot({ trigger: "github_scheduled", startedBy: null });
    return Response.json(result);
  } catch (e: any) {
    console.error("[cron github-snapshot]", e?.message ?? e);
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}