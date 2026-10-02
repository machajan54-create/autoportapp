import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TvDisplay } from "@/components/tv/TvDisplay";
import { getTvPublicToken } from "@/lib/tv-widgets.functions";
...
    async function load() {
      try {
        const { token } = await getTvPublicToken();
        if (cancelled) return;
        if (token) setToken(token);
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
