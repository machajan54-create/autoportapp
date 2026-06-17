import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

/**
 * Týdenní přehled pro adminy — voláno přes pg_cron každé pondělí v 7:00.
 * Autorizace: hlavička `apikey` musí obsahovat Supabase publishable klíč
 * (posílá pg_cron job). Bez ní vrací 401.
 */
export const Route = createFileRoute("/api/public/hooks/weekly-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireCronAuth(request);
        if (unauthorized) return unauthorized;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { notifyAdmins } = await import("@/lib/email/notify.server");

          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
          const fromIso = weekAgo.toISOString();

          // Pojistné události
          const { data: claims } = await supabaseAdmin
            .from("claims")
            .select("id, status, created_at");
          const claimsActive = (claims ?? []).filter((c: any) => c.status !== "done" && c.status !== "closed").length;
          const claimsNew = (claims ?? []).filter((c: any) => c.created_at >= fromIso).length;

          // Ojeté vozy
          const { data: vyk } = await supabaseAdmin
            .from("vykupy")
            .select("id, stav, prodano_za, vykoupeno_za, prodano_at");
          const aktivni = (vyk ?? []).filter((v: any) => v.stav !== "Prodáno" && v.stav !== "Zamítnuto").length;
          const prodanoTyden = (vyk ?? []).filter((v: any) => v.stav === "Prodáno" && v.prodano_at && v.prodano_at >= fromIso);
          const obrat = prodanoTyden.reduce((s: number, v: any) => s + (v.prodano_za ?? 0), 0);
          const marze = prodanoTyden.reduce((s: number, v: any) => s + ((v.prodano_za ?? 0) - (v.vykoupeno_za ?? 0)), 0);

          // Závady
          const { data: defects } = await supabaseAdmin
            .from("defects")
            .select("id, status, priority");
          const defectsOpen = (defects ?? []).filter((d: any) => d.status === "new" || d.status === "in_progress").length;
          const defectsCritical = (defects ?? []).filter((d: any) => d.priority === "critical" && d.status !== "closed" && d.status !== "resolved").length;

          // Docházka — týdně
          const { data: recs } = await supabaseAdmin
            .from("attendance_records")
            .select("hours_worked, employee_id, date")
            .gte("date", weekAgo.toISOString().slice(0, 10));
          const dochazkaHours = (recs ?? []).reduce((s: number, r: any) => s + Number(r.hours_worked ?? 0), 0);

          // DPP varování — ročně
          const { data: emps } = await supabaseAdmin
            .from("attendance_employees")
            .select("id, name, employment_type, active");
          const { data: yearRecs } = await supabaseAdmin
            .from("attendance_records")
            .select("hours_worked, employee_id")
            .gte("date", yearStart);
          const dpp = (emps ?? []).filter((e: any) => e.employment_type === "dpp" && e.active);
          const hoursById = new Map<string, number>();
          for (const r of yearRecs ?? []) {
            hoursById.set(r.employee_id, (hoursById.get(r.employee_id) ?? 0) + Number(r.hours_worked ?? 0));
          }
          const dppWarnings = dpp
            .map((e: any) => ({ name: e.name, hours: hoursById.get(e.id) ?? 0 }))
            .filter((x) => x.hours >= 270)
            .sort((a, b) => b.hours - a.hours);

          // Čekající absence
          const { count: absencesPending } = await supabaseAdmin
            .from("attendance_absences")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending");

          const periodLabel = `${weekAgo.toLocaleDateString("cs-CZ")} – ${now.toLocaleDateString("cs-CZ")}`;

          await notifyAdmins({
            templateName: "weekly-report",
            idempotencyKey: `weekly-${now.toISOString().slice(0, 10)}`,
            templateData: {
              periodLabel,
              claimsActive,
              claimsNew,
              vykupyActive: aktivni,
              vykupySold: prodanoTyden.length,
              obratKc: obrat,
              marzeKc: marze,
              defectsOpen,
              defectsCritical,
              dochazkaHours,
              dppWarnings,
              absencesPending: absencesPending ?? 0,
            },
          });

          return Response.json({ ok: true });
        } catch (e: any) {
          console.error("[weekly-report] failed", e?.message ?? e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});