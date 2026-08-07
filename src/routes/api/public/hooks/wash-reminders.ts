import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

const APP_BASE = "https://www.autoport-app.cz";

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("cs-CZ");
  } catch {
    return d ?? "";
  }
}
function fmtDateTime(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d ?? "";
  }
}

/**
 * Hourly cron endpoint:
 * Finds pending wash assignments that have not been confirmed/declined
 * within ~2h of the last send/reminder, and re-sends a reminder email
 * with the same Accept/Decline token.
 *
 * Triggered by pg_cron hourly; safe to call multiple times —
 * the 2h window prevents duplicates.
 */
export const Route = createFileRoute("/api/public/hooks/wash-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await requireCronAuth(request);
        if (unauthorized) return unauthorized;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { enqueueTransactionalEmail } = await import("@/lib/email/notify.server");

        // ~2h window (1h55m) so hourly cron consistently re-sends after 2h.
        const cutoff = new Date(Date.now() - 115 * 60 * 1000).toISOString();

        // pending assignments where last contact (reminder or send) was > ~24h ago
        const { data: assignments, error } = await supabaseAdmin
          .from("evidence_wash_assignments")
          .select(
            "id, order_id, washer_id, confirm_token, sent_at, last_reminder_at, reminder_count",
          )
          .eq("status", "pending");
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const due = (assignments ?? []).filter((a: any) => {
          const last = a.last_reminder_at ?? a.sent_at;
          if (!last) return true;
          return new Date(last).toISOString() <= cutoff;
        });

        let sent = 0;
        let skipped = 0;

        for (const a of due) {
          const [{ data: order }, { data: washer }] = await Promise.all([
            supabaseAdmin
              .from("evidence_orders")
              .select(
                "klient, vozidlo, vis, den, hodina, cislo_zakazky, poznamka, stav, pickup_from, complete_by",
              )
              .eq("id", a.order_id)
              .maybeSingle(),
            supabaseAdmin
              .from("washers")
              .select("name, email, active")
              .eq("id", a.washer_id)
              .maybeSingle(),
          ]);

          if (!order || !washer || washer.active === false || order.stav === "zruseno") {
            skipped++;
            continue;
          }

          // Only chase orders that are still planned (no end date, or end date today+)
          if (order.complete_by) {
            const end = new Date(order.complete_by as string).getTime();
            if (!Number.isNaN(end) && end < Date.now() - 12 * 60 * 60 * 1000) {
              skipped++;
              continue;
            }
          }

          const reminderNumber = (a.reminder_count ?? 0) + 1;
          try {
            await enqueueTransactionalEmail({
              templateName: "wash-reminder",
              recipientEmail: washer.email,
              idempotencyKey: `wash-reminder-${a.id}-${new Date().toISOString().slice(0, 10)}`,
              templateData: {
                recipientName: washer.name ?? "",
                klient: order.klient ?? "",
                vozidlo: order.vozidlo ?? "",
                vis: order.vis ?? "",
                pickupFrom: fmtDateTime(order.pickup_from as any),
                completeBy: fmtDateTime(order.complete_by as any),
                den: fmtDate(order.den as any),
                hodina: order.hodina ?? "",
                cisloZakazky: order.cislo_zakazky ?? "",
                poznamka: order.poznamka ?? "",
                acceptUrl: `${APP_BASE}/wash-respond/accept/${a.confirm_token}`,
                declineUrl: `${APP_BASE}/wash-respond/decline/${a.confirm_token}`,
                reminderNumber,
              },
            });
            await supabaseAdmin
              .from("evidence_wash_assignments")
              .update({
                last_reminder_at: new Date().toISOString(),
                reminder_count: reminderNumber,
              })
              .eq("id", a.id);
            sent++;
          } catch (e) {
            console.error("[wash-reminders] send failed", a.id, e);
            skipped++;
          }
        }

        return new Response(
          JSON.stringify({ ok: true, sent, skipped, checked: assignments?.length ?? 0 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
