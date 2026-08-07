import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TvDisplay } from "@/components/tv/TvDisplay";

export const Route = createFileRoute("/TVdisplay")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autoport TV Display" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=1920, initial-scale=1" },
    ],
  }),
  component: TvDisplayPreview,
});

function TvDisplayPreview() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase
          .from("display_config")
          .select("token")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (data?.token) setToken(data.token);
      } catch {
        // fail silently – the display will show a config error state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0b0f1a",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        Načítání TV náhledu…
      </div>
    );
  }

  if (!token) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0b0f1a",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700 }}>TV display není nastaven</div>
        <div style={{ opacity: 0.6 }}>Vytvořte konfiguraci v administraci.</div>
      </div>
    );
  }

  return <TvDisplay token={token} />;
}
