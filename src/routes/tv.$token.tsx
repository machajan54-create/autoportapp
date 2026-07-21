import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import autoportLogo from "@/assets/autoport-logo.png.asset.json";

export const Route = createFileRoute("/tv/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autoport TV Display" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=1920, initial-scale=1" },
    ],
  }),
  component: TvDisplay,
});

type Slide = {
  id: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  type: "news" | "promo" | "vehicle" | "video";
  duration_sec: number;
  sort_order: number;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
};

type DisplayConfig = {
  id: string;
  name: string;
  token: string;
  ticker_text: string | null;
  show_weather: boolean;
  show_clock: boolean;
};

const LS_SLIDES = "tv-display:slides-cache";
const LS_CONFIG = "tv-display:config-cache";

function isSlideValidNow(s: Slide, now = Date.now()) {
  if (!s.active) return false;
  if (s.valid_from && Date.parse(s.valid_from) > now) return false;
  if (s.valid_to && Date.parse(s.valid_to) < now) return false;
  return true;
}

async function resolveImageUrl(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  // Storage path in `slides` bucket → signed URL
  const { data } = await supabase.storage.from("slides").createSignedUrl(raw, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

function TvDisplay() {
  const { token } = Route.useParams();
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [resolvedImages, setResolvedImages] = useState<Record<string, string | null>>({});
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  // Load config + slides
  const load = useCallback(async () => {
    try {
      const { data: cfg, error: cfgErr } = await supabase
        .from("display_config")
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (cfgErr) throw cfgErr;
      if (cfg) {
        setConfig(cfg as DisplayConfig);
        localStorage.setItem(LS_CONFIG + ":" + token, JSON.stringify(cfg));
      }

      const { data: rows, error: sErr } = await supabase
        .from("slides")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (sErr) throw sErr;
      const filtered = (rows ?? []).filter((s: any) => isSlideValidNow(s as Slide)) as Slide[];
      setSlides(filtered);
      localStorage.setItem(LS_SLIDES, JSON.stringify(filtered));
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Fallback to cache
      const cachedCfg = localStorage.getItem(LS_CONFIG + ":" + token);
      const cachedSlides = localStorage.getItem(LS_SLIDES);
      if (cachedCfg) setConfig(JSON.parse(cachedCfg));
      if (cachedSlides) setSlides(JSON.parse(cachedSlides));
      setError(msg);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Resolve image URLs whenever slides change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string | null> = {};
      for (const s of slides) {
        next[s.id] = await resolveImageUrl(s.image_url);
      }
      if (!cancelled) setResolvedImages(next);
    })();
    return () => { cancelled = true; };
  }, [slides]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase
      .channel("tv-display-" + token)
      .on("postgres_changes", { event: "*", schema: "public", table: "slides" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "display_config" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [token, load]);

  // Advance slides
  useEffect(() => {
    if (!slides.length) return;
    const cur = slides[index % slides.length];
    const dur = Math.max(3, cur?.duration_sec ?? 12) * 1000;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), dur);
    return () => clearTimeout(t);
  }, [index, slides]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Wake lock + cursor hide + 6h reload
  useEffect(() => {
    document.body.style.cursor = "none";
    document.documentElement.style.background = "#000";
    let wl: any = null;
    async function acquire() {
      try {
        // @ts-expect-error experimental API
        if (navigator.wakeLock?.request) wl = await navigator.wakeLock.request("screen");
      } catch {}
    }
    acquire();
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVis);
    const reload = setTimeout(() => location.reload(), 6 * 60 * 60 * 1000);
    return () => {
      document.body.style.cursor = "";
      document.removeEventListener("visibilitychange", onVis);
      clearTimeout(reload);
      try { wl?.release?.(); } catch {}
    };
  }, []);

  const current = slides.length ? slides[index % slides.length] : null;
  const nextSlide = slides.length ? slides[(index + 1) % slides.length] : null;

  // Preload next image
  useEffect(() => {
    if (!nextSlide) return;
    const url = resolvedImages[nextSlide.id];
    if (url) { const img = new Image(); img.src = url; }
  }, [nextSlide, resolvedImages]);

  const durationMs = Math.max(3, current?.duration_sec ?? 12) * 1000;

  return (
    <div
      className="tv-root"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        background: "#0b0f1a",
        color: "white",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      {/* Slide layers (crossfade) */}
      {slides.length === 0 ? (
        <BrandingSlide />
      ) : (
        slides.map((s, i) => {
          const active = i === index % slides.length;
          const img = resolvedImages[s.id] ?? null;
          return (
            <SlideLayer key={s.id} slide={s} imageUrl={img} active={active} />
          );
        })
      )}

      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 96,
          padding: "0 5vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0))",
          zIndex: 10,
        }}
      >
        <img src={autoportLogo.url} alt="Autoport" style={{ height: 56, filter: "brightness(0) invert(1)" }} />
        {config?.show_clock !== false && (
          <div style={{ textAlign: "right", lineHeight: 1.05 }}>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {now.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={{ fontSize: 20, opacity: 0.85 }}>
              {now.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        )}
      </div>

      {/* Ticker */}
      {config?.ticker_text && (
        <div
          style={{
            position: "absolute",
            left: 0, right: 0, bottom: 0,
            height: 64,
            background: "rgba(0,0,0,0.75)",
            color: "white",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            zIndex: 10,
          }}
        >
          <div className="tv-ticker" style={{ whiteSpace: "nowrap", fontSize: 26, fontWeight: 500, paddingLeft: "100vw" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} style={{ marginRight: 120 }}>{config.ticker_text}</span>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {current && (
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          bottom: config?.ticker_text ? 64 : 0,
          height: 4,
          background: "rgba(255,255,255,0.15)",
          zIndex: 11,
        }}>
          <div
            key={current.id + "-" + index}
            style={{
              height: "100%",
              background: "#f97316",
              width: "100%",
              transformOrigin: "left center",
              animation: `tv-progress ${durationMs}ms linear forwards`,
            }}
          />
        </div>
      )}

      {error && (
        <div style={{
          position: "absolute", top: 8, left: 8,
          fontSize: 10, color: "rgba(255,255,255,0.35)", zIndex: 20,
        }}>
          offline režim
        </div>
      )}

      <style>{`
        @keyframes tv-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes tv-fadein { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tv-fadeout { from { opacity: 1; } to { opacity: 0; } }
        @keyframes tv-kenburns { from { transform: scale(1); } to { transform: scale(1.08); } }
        @keyframes tv-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        .tv-ticker { animation: tv-ticker-scroll 45s linear infinite; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function SlideLayer({ slide, imageUrl, active }: { slide: Slide; imageUrl: string | null; active: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: active ? 1 : 0,
        transition: "opacity 800ms ease-in-out",
        pointerEvents: "none",
      }}
    >
      {imageUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            animation: active ? `tv-kenburns ${(slide.duration_sec + 4) * 1000}ms ease-out forwards` : "none",
          }}
        />
      )}
      {/* Overlay for readability */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: imageUrl
          ? "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)"
          : "radial-gradient(ellipse at center, #1f2b47 0%, #0b0f1a 100%)",
      }} />

      {/* Content — safe area 5% */}
      <div style={{
        position: "absolute",
        left: "5%", right: "5%",
        top: "5%", bottom: "5%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        paddingBottom: 120,
      }}>
        {slide.type && (
          <div style={{
            display: "inline-block",
            alignSelf: "flex-start",
            padding: "8px 20px",
            background: badgeColor(slide.type),
            color: "white",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            borderRadius: 8,
            marginBottom: 32,
          }}>{badgeLabel(slide.type)}</div>
        )}
        {slide.title && (
          <h1 style={{
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            margin: 0,
            textShadow: "0 4px 24px rgba(0,0,0,0.6)",
          }}>{slide.title}</h1>
        )}
        {slide.subtitle && (
          <div style={{
            fontSize: 40,
            fontWeight: 500,
            marginTop: 20,
            opacity: 0.95,
            textShadow: "0 2px 16px rgba(0,0,0,0.6)",
          }}>{slide.subtitle}</div>
        )}
        {slide.body && (
          <div style={{
            fontSize: 32,
            fontWeight: 400,
            marginTop: 24,
            maxWidth: "70%",
            lineHeight: 1.35,
            opacity: 0.9,
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}>{slide.body}</div>
        )}
      </div>
    </div>
  );
}

function BrandingSlide() {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: "radial-gradient(ellipse at center, #1f2b47 0%, #0b0f1a 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 40,
    }}>
      <img src={autoportLogo.url} alt="Autoport" style={{ height: 140, filter: "brightness(0) invert(1)" }} />
      <div style={{ fontSize: 44, fontWeight: 300, opacity: 0.75, letterSpacing: "0.02em" }}>
        Vítejte v Autoportu
      </div>
    </div>
  );
}

function badgeLabel(t: Slide["type"]) {
  return { news: "Novinka", promo: "Akce", vehicle: "Vozidlo", video: "Video" }[t] ?? t;
}
function badgeColor(t: Slide["type"]) {
  return {
    news: "#2563eb",
    promo: "#f97316",
    vehicle: "#059669",
    video: "#7c3aed",
  }[t] ?? "#334155";
}