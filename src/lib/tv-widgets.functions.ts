import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public, token-scoped read of aggregated data for the TV Display.
// Never returns PII. Validates the display token before returning data.

const InputSchema = z.object({
  token: z.string().min(4).max(200),
  widget: z.enum(["stats", "at_work", "vehicles", "news", "weather", "sauto"]),
});

export type TvVehicleCard = {
  id: string;
  znacka: string;
  model: string;
  rok_vyroby: number | null;
  pocet_km: number | null;
  barva: string | null;
  photo_url: string | null;
};

export type TvWidgetResult =
  | {
      widget: "stats";
      day: { vykupy: number; prodano: number; ukoly_done: number };
      week: { vykupy: number; prodano: number };
    }
  | { widget: "at_work"; people: { name: string }[] }
  | { widget: "vehicles"; vehicles: TvVehicleCard[] }
  | { widget: "news"; items: { id: string; title: string; body: string | null }[] }
  | { widget: "weather"; temp_c: number | null; code: number | null; city: string };

export const getTvWidgetData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<TvWidgetResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validate token
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("display_config")
      .select("id, token")
      .eq("token", data.token)
      .maybeSingle();
    if (cfgErr) throw new Error(cfgErr.message);
    if (!cfg) throw new Error("Neplatný token");

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7));

    if (data.widget === "stats") {
      const [vDay, vWeek, prodDay, prodWeek, ukoly] = await Promise.all([
        supabaseAdmin
          .from("vykupy")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfDay.toISOString()),
        supabaseAdmin
          .from("vykupy")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfWeek.toISOString()),
        supabaseAdmin
          .from("vykupy")
          .select("id", { count: "exact", head: true })
          .eq("stav", "Prodáno")
          .gte("stav_changed_at", startOfDay.toISOString()),
        supabaseAdmin
          .from("vykupy")
          .select("id", { count: "exact", head: true })
          .eq("stav", "Prodáno")
          .gte("stav_changed_at", startOfWeek.toISOString()),
        supabaseAdmin
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "done")
          .gte("updated_at", startOfDay.toISOString()),
      ]);
      return {
        widget: "stats",
        day: { vykupy: vDay.count ?? 0, prodano: prodDay.count ?? 0, ukoly_done: ukoly.count ?? 0 },
        week: { vykupy: vWeek.count ?? 0, prodano: prodWeek.count ?? 0 },
      };
    }

    if (data.widget === "at_work") {
      const { data: rows } = await supabaseAdmin
        .from("attendance_records")
        .select("employee_id, check_in_at, check_out_at")
        .gte("check_in_at", startOfDay.toISOString())
        .is("check_out_at", null);
      const ids = Array.from(new Set((rows ?? []).map((r: any) => r.employee_id).filter(Boolean)));
      if (!ids.length) return { widget: "at_work", people: [] };
      const { data: emps } = await supabaseAdmin
        .from("attendance_employees")
        .select("id, name")
        .in("id", ids);
      return { widget: "at_work", people: (emps ?? []).map((e: any) => ({ name: e.name })) };
    }

    if (data.widget === "vehicles") {
      const { data: rows } = await supabaseAdmin
        .from("vykupy")
        .select("id, znacka, model, rok_vyroby, pocet_km, barva, stav, stav_changed_at")
        .eq("stav", "Vykoupeno")
        .order("stav_changed_at", { ascending: false })
        .limit(8);
      const list = rows ?? [];
      // Photos (first photo per vykup)
      const photos: Record<string, string | null> = {};
      if (list.length) {
        const { data: ph } = await supabaseAdmin
          .from("vykup_photos")
          .select("vykup_id, storage_path, created_at")
          .in(
            "vykup_id",
            list.map((r: any) => r.id),
          )
          .order("created_at", { ascending: true });
        for (const p of ph ?? []) {
          if (!photos[(p as any).vykup_id]) photos[(p as any).vykup_id] = (p as any).storage_path;
        }
        const paths = Object.values(photos).filter((v): v is string => !!v);
        if (paths.length) {
          const { data: signed } = await supabaseAdmin.storage
            .from("vykup-photos")
            .createSignedUrls(paths, 60 * 60 * 6);
          const map = new Map((signed ?? []).map((s: any) => [s.path, s.signedUrl]));
          for (const k of Object.keys(photos)) {
            const path = photos[k];
            photos[k] = path ? (map.get(path) ?? null) : null;
          }
        }
      }
      return {
        widget: "vehicles",
        vehicles: list.map((r: any) => ({
          id: r.id,
          znacka: r.znacka,
          model: r.model,
          rok_vyroby: r.rok_vyroby,
          pocet_km: r.pocet_km,
          barva: r.barva,
          photo_url: photos[r.id] ?? null,
        })),
      };
    }

    if (data.widget === "news") {
      const { data: rows } = await supabaseAdmin
        .from("display_news")
        .select("id, title, body, active, valid_from, valid_to, sort_order, created_at")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(10);
      const nowMs = Date.now();
      const items = (rows ?? []).filter((r: any) => {
        if (r.valid_from && Date.parse(r.valid_from) > nowMs) return false;
        if (r.valid_to && Date.parse(r.valid_to) < nowMs) return false;
        return true;
      });
      return {
        widget: "news",
        items: items.map((r: any) => ({ id: r.id, title: r.title, body: r.body })),
      };
    }

    if (data.widget === "weather") {
      // Open-meteo, no API key. Default Brno (Autoport).
      const city = "Brno";
      const lat = 49.1951;
      const lon = 16.6068;
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Europe%2FPrague`,
        );
        const json: any = await res.json();
        return {
          widget: "weather",
          temp_c: json?.current?.temperature_2m ?? null,
          code: json?.current?.weather_code ?? null,
          city,
        };
      } catch {
        return { widget: "weather", temp_c: null, code: null, city };
      }
    }

    throw new Error("Unknown widget");
  });
