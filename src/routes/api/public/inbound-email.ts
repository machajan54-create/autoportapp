import { createFileRoute } from "@tanstack/react-router";
import { followUpDate, normalizeInbound, pickClient } from "@/lib/inbound-email";

// Receives inbound emails (e.g. Postmark inbound webhook) sent with the CRM address in Cc/Bcc.
// Auth: ?token=<INBOUND_EMAIL_SECRET> in the webhook URL.
export const Route = createFileRoute("/api/public/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INBOUND_EMAIL_SECRET;
        const token = new URL(request.url).searchParams.get("token");
        if (!secret || token !== secret) return new Response("Neautorizováno", { status: 401 });

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Neplatný JSON" }, { status: 400 });
        }
        const mail = normalizeInbound(payload);
        if (!mail) return Response.json({ ok: false, error: "Chybí odesílatel" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: profiles } = await supabaseAdmin.from("profiles").select("id,email,full_name");
        const internal = new Set((profiles ?? []).map((p) => (p.email ?? "").toLowerCase()).filter(Boolean));
        const owner = (profiles ?? []).find((p) => (p.email ?? "").toLowerCase() === mail.from.email);
        // Ignore mail from non-employees (cannot assign / anti-spam). 200 so provider doesn't retry.
        if (!owner) return Response.json({ ok: true, ignored: "odesílatel není zaměstnanec" });

        const client = pickClient(mail, internal, "autoport-app.cz");
        if (!client) return Response.json({ ok: true, ignored: "nenalezen klient" });

        const followUp = followUpDate(new Date()).toISOString();
        const stamp = new Date().toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
        const noteLine = `[${stamp}] E-mail: ${mail.subject || "(bez předmětu)"}`;

        const { data: existing } = await supabaseAdmin
          .from("deals")
          .select("id,notes,stage")
          .ilike("contact", `%${client.email}%`)
          .not("stage", "in", "(won,lost)")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from("deals")
            .update({
              follow_up_at: followUp,
              follow_up_notified_at: null,
              notes: [existing.notes, noteLine].filter(Boolean).join("\n"),
            })
            .eq("id", existing.id);
          return Response.json({ ok: true, updated: existing.id });
        }

        const { data: row, error } = await supabaseAdmin
          .from("deals")
          .insert({
            title: mail.subject || `Nabídka – ${client.name || client.email}`,
            client_name: client.name || null,
            contact: client.email,
            stage: "lead",
            notes: [noteLine, mail.text.slice(0, 1500)].filter(Boolean).join("\n\n"),
            follow_up_at: followUp,
            owner_id: owner.id,
            owner_name: owner.full_name || owner.email,
          })
          .select("id")
          .single();
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true, created: row.id });
      },
    },
  },
});
