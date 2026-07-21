import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import autoportLogo from "@/assets/autoport-logo.png.asset.json";
import citroenLogo from "@/assets/citroen-logo.png.asset.json";
import peugeotLogo from "@/assets/peugeot-logo.png.asset.json";
import citroenAutoportLogo from "@/assets/citroen-autoport-logo-white.png.asset.json";
import { SlideRenderer, type TvSlide } from "@/components/tv/SlideRenderer";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getTvWidgetData } from "@/lib/tv-widgets.functions";

type Slide = TvSlide;

type DisplayConfig = {
  id: string;
  name: string;
  token: string;
  ticker_text: string | null;
  show_weather: boolean;
  show_clock: boolean;
  show_feedback?: boolean;
  show_lounge?: boolean;
  feedback_duration_sec?: number;
  lounge_duration_sec?: number;
};

const LS_SLIDES = "tv-display:slides-cache-v2";
const LS_CONFIG = "tv-display:config-cache";

function isSlideValidNow(s: Slide, now = Date.now()) {
  if (!s.active) return false;
  if (s.valid_from && Date.parse(s.valid_from) > now) return false;
  if (s.valid_to && Date.parse(s.valid_to) < now) return false;
  return true;
}

function buildFeedbackSlide(duration = 15): Slide {
  return {
    id: "__feedback_qr__",
    title: "Napište nám",
    subtitle: "Vaše zpětná vazba nás posouvá dál",
    body: "Naskenujte QR kód mobilem a otevře se krátký formulář.",
    image_url: null,
    type: "feedback",
    kind: "feedback_qr",
    payload: {},
    duration_sec: duration,
    transition: "fade",
    weight: 1,
    sort_order: 9999,
    active: true,
    valid_from: null,
    valid_to: null,
  };
}

function buildLoungeSlide(duration = 12): Slide {
  return {
    id: "__lounge__",
    title: "Zákaznický koutek",
    subtitle: "Dejte si v klidu kávu a usaďte se",
    body: "Za chvíli se Vám budeme věnovat. Užijte si šálek kávy nebo čaje na naši účet.",
    image_url: null,
    type: "lounge",
    kind: "lounge",
    payload: {},
    duration_sec: duration,
    transition: "fade",
    weight: 1,
    sort_order: 9998,
    active: true,
    valid_from: null,
    valid_to: null,
  };
}

function buildBuyoutSlide(duration = 14): Slide {
  return {
    id: "__buyout__",
    title: "Vykupujeme vozy všech značek",
    subtitle: "Rychle, férově a bez starostí",
    body:
      "Nabídneme Vám cenu do 24 hodin. Postaráme se o všechny papíry, odhlášení i převod. Peníze obdržíte ihned.",
    image_url: null,
    type: "buyout",
    kind: "buyout",
    payload: {},
    duration_sec: duration,
    transition: "fade",
    weight: 1,
    sort_order: 9997,
    active: true,
    valid_from: null,
    valid_to: null,
  };
}

export function TvDisplay({ token }: { token: string }) {
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
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
      const filtered = (rows ?? [])
        .map((r: any): Slide => ({
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          body: r.body,
          image_url: r.image_url,
          type: r.type ?? "news",
          kind: r.kind ?? "image",
          payload: r.payload ?? {},
          duration_sec: r.duration_sec ?? 12,
          transition: r.transition ?? "fade",
          weight: r.weight ?? 1,
          sort_order: r.sort_order ?? 0,
          active: !!r.active,
          valid_from: r.valid_from,
          valid_to: r.valid_to,
        }))
        .filter((s) => isSlideValidNow(s));
      const cfgTyped = cfg as DisplayConfig | null;
      const showLounge = cfgTyped?.show_lounge !== false;
      const showFeedback = cfgTyped?.show_feedback !== false;
      const loungeDur = Math.max(3, Number(cfgTyped?.lounge_duration_sec ?? 12));
      const feedbackDur = Math.max(3, Number(cfgTyped?.feedback_duration_sec ?? 15));
      const extras: Slide[] = [];
      if (showLounge) extras.push(buildLoungeSlide(loungeDur));
      if (showFeedback) extras.push(buildFeedbackSlide(feedbackDur));
      extras.push(buildBuyoutSlide());
      const withExtras = [...filtered, ...extras];
      setSlides(withExtras);
      localStorage.setItem(LS_SLIDES, JSON.stringify(withExtras));
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

  // Realtime updates
  useEffect(() => {
    const ch = supabase
      .channel("tv-display-" + token)
      .on("postgres_changes", { event: "*", schema: "public", table: "slides" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "display_config" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "display_news" }, () => load())
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
        const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<unknown> } };
        if (nav.wakeLock?.request) wl = await nav.wakeLock.request("screen");
      } catch { /* ignore */ }
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
  const durationMs = Math.max(3, current?.duration_sec ?? 12) * 1000;

  return (
    <div
      className="tv-root"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        background: "hsl(220 60% 6%)",
        color: "white",
        overflow: "hidden",
        fontFamily: "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      {/* Ambient background glow */}
      <div style={{
        position: "absolute", top: "-10%", right: "-10%", width: 800, height: 800,
        background: "rgba(108, 92, 231, 0.10)", filter: "blur(150px)", borderRadius: "50%",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "absolute", bottom: "-5%", left: "10%", width: 600, height: 600,
        background: "rgba(255, 107, 53, 0.06)", filter: "blur(120px)", borderRadius: "50%",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Slide layers (crossfade) */}
      {slides.length === 0 ? (
        <BrandingSlide />
      ) : (
        slides.map((s, i) => {
          const active = i === index % slides.length;
          return (
            <SlideRenderer
              key={s.id}
              slide={s}
              token={token}
              active={active}
              onFinished={() => setIndex((i) => (i + 1) % slides.length)}
            />
          );
        })
      )}

      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 128,
          padding: "0 4vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, rgba(5,10,20,0.85), rgba(5,10,20,0))",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          zIndex: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src={citroenAutoportLogo.url}
            alt="Citroën Autoport"
            style={{ height: 78, width: "auto", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}
          />
          <div style={{ width: 1, height: 50, background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.25), transparent)", animation: "fade-in 0.6s ease-out both", animationDelay: "0.1s" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="animate-fade-in" style={{
              animationDelay: "0.2s", animationFillMode: "both",
              display: "flex", alignItems: "center", gap: 10,
              height: 50,
              padding: "0 14px",
              background: "rgba(255,255,255,0.94)",
              borderRadius: 12,
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
              backdropFilter: "blur(8px)",
            }}>
              <img src={citroenLogo.url} alt="Citroën" style={{ height: 32, width: 32, objectFit: "contain", flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", lineHeight: 1.15, color: "#0b0f1a" }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.55 }}>
                  Autorizovaný
                </div>
                <div style={{ fontFamily: "'Space Grotesk', system-ui", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  Prodejce & Servis
                </div>
              </div>
            </div>
            <div className="animate-fade-in" style={{
              animationDelay: "0.35s", animationFillMode: "both",
              display: "flex", alignItems: "center", gap: 10,
              height: 50,
              padding: "0 14px",
              background: "rgba(255,255,255,0.94)",
              borderRadius: 12,
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
              backdropFilter: "blur(8px)",
            }}>
              <img src={peugeotLogo.url} alt="Peugeot" style={{ height: 32, width: 32, objectFit: "contain", flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", lineHeight: 1.15, color: "#0b0f1a" }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.55 }}>
                  Autorizovaný servis
                </div>
                <div style={{ fontFamily: "'Space Grotesk', system-ui", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  Nově od září 2026
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {config?.show_clock !== false && (
            <div style={{ textAlign: "right", lineHeight: 1.05 }}>
              <div style={{ fontSize: 11, opacity: 0.4, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
                Právě je
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', system-ui",
                fontSize: 46, fontWeight: 700, letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
              }}>
                {now.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div style={{ fontSize: 14, opacity: 0.55 }}>
                {now.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          )}
          <WeatherPill token={token} enabled={config?.show_weather !== false} />
        </div>
      </div>

      {/* Right sidebar with live widgets */}
      <TvSidebar token={token} />

      {/* Ticker */}
      {config?.ticker_text && (
        <div
          style={{
            position: "absolute",
            left: 0, right: 0, bottom: 0,
            height: 80,
            background: "rgba(0,0,0,0.55)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            color: "white",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            zIndex: 12,
          }}
        >
          <div style={{
            height: "100%", padding: "0 40px",
            background: "linear-gradient(90deg, #ff6b35, #f7931e)",
            color: "#0b0f1a",
            display: "flex", alignItems: "center",
            fontFamily: "'Space Grotesk', system-ui",
            fontWeight: 800, fontStyle: "italic",
            letterSpacing: "-0.02em", fontSize: 26, textTransform: "uppercase",
            boxShadow: "10px 0 30px rgba(0,0,0,0.5)",
            zIndex: 2, flexShrink: 0,
          }}>NEWSFLASH</div>
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
          bottom: config?.ticker_text ? 80 : 0,
          height: 3,
          background: "rgba(255,255,255,0.15)",
          zIndex: 11,
        }}>
          <div
            key={current.id + "-" + index}
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #ff6b35, #e84393)",
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
        @keyframes tv-pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes tv-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        .tv-ticker { animation: tv-ticker-scroll 45s linear infinite; }
        ::-webkit-scrollbar { display: none; }
        .tv-layer { position: absolute; inset: 0; opacity: 0; transition: opacity 800ms ease-in-out; pointer-events: none; }
        .tv-layer[data-active="true"] { opacity: 1; }
        .tv-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
        .tv-vignette { position: absolute; inset: 0; }
        /* Content area: left 4%, top 160px, right 37% (sidebar 33% + gap), bottom 100px */
        .tv-content { position: absolute; left: 4%; right: 37%; top: 160px; bottom: 100px; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; }
        .tv-badge {
          display: inline-flex; align-items: center; gap: 12px;
          align-self: flex-start; padding: 10px 24px;
          background: #ff6b35; color: #0b0f1a;
          font-family: 'Space Grotesk', system-ui;
          font-size: 20px; font-weight: 800; letter-spacing: 0.14em;
          text-transform: uppercase; border-radius: 999px;
          margin-bottom: 28px;
          box-shadow: 0 8px 32px rgba(255,107,53,0.35);
        }
        .tv-badge::before {
          content: ""; width: 10px; height: 10px; border-radius: 50%;
          background: #0b0f1a; animation: tv-pulse-dot 1.4s ease-in-out infinite;
        }
        .tv-title {
          font-family: 'Space Grotesk', system-ui;
          font-size: 112px; font-weight: 700; line-height: 0.92;
          letter-spacing: -0.04em; margin: 0;
          text-shadow: 0 4px 32px rgba(0,0,0,0.6);
        }
        .tv-title-accent {
          background: linear-gradient(90deg, #ff6b35, #e84393, #6c5ce7);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent;
        }
        .tv-subtitle { font-size: 44px; font-weight: 500; margin-top: 20px; opacity: 0.85; text-shadow: 0 2px 16px rgba(0,0,0,0.55); }
        .tv-body { font-size: 30px; font-weight: 400; margin-top: 24px; line-height: 1.35; opacity: 0.75; max-width: 900px; text-shadow: 0 2px 12px rgba(0,0,0,0.55); }
        .tv-bullets { list-style: none; margin: 32px 0 0; padding: 0; display: flex; flex-direction: column; gap: 22px; }
        .tv-bullets li { display: flex; align-items: center; gap: 24px; font-size: 36px; }
        .tv-bullet-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; background: linear-gradient(135deg, #ff6b35, #e84393); }

        /* Sidebar */
        .tv-sidebar {
          position: absolute; right: 0; top: 160px; bottom: 100px; width: 33%;
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-left: 1px solid rgba(255,255,255,0.08);
          padding: 32px 36px 32px 32px;
          display: flex; flex-direction: column; gap: 24px;
          z-index: 11; overflow: hidden;
        }
        .tv-side-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 22px 24px; }
        .tv-side-label { color: rgba(255,255,255,0.4); font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 14px; }
        .tv-stat-val { font-family: 'Space Grotesk', system-ui; font-size: 40px; font-weight: 700; line-height: 1; }
        .tv-stat-lbl { font-size: 12px; opacity: 0.5; margin-top: 6px; }
        .tv-person-row { display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; }
        .tv-avatar { width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0; }
        .tv-live-dot { margin-left: auto; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 12px #22c55e; }
      `}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=DM+Sans:wght@400;500;700&display=swap" />
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

function WeatherPill({ token, enabled }: { token: string; enabled: boolean }) {
  const fn = useServerFn(getTvWidgetData);
  const q = useQuery({
    queryKey: ["tv-weather", token],
    queryFn: () => fn({ data: { token, widget: "weather" } }),
    enabled,
    refetchInterval: 15 * 60 * 1000,
  });
  if (!enabled) return null;
  const w = q.data && q.data.widget === "weather" ? q.data : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 32, borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ textAlign: "right", lineHeight: 1.05 }}>
        <div style={{ fontSize: 11, opacity: 0.4, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
          Počasí
        </div>
        <div style={{ fontFamily: "'Space Grotesk', system-ui", fontSize: 46, fontWeight: 700, letterSpacing: "-0.02em" }}>
          {w?.temp_c != null ? `${Math.round(w.temp_c)}°C` : "—"}
        </div>
      </div>
    </div>
  );
}

function TvSidebar({ token }: { token: string }) {
  const fn = useServerFn(getTvWidgetData);
  const statsQ = useQuery({
    queryKey: ["tv-widget", token, "stats"],
    queryFn: () => fn({ data: { token, widget: "stats" } }),
    refetchInterval: 60 * 1000,
  });
  const atWorkQ = useQuery({
    queryKey: ["tv-widget", token, "at_work"],
    queryFn: () => fn({ data: { token, widget: "at_work" } }),
    refetchInterval: 30 * 1000,
  });
  const newsQ = useQuery({
    queryKey: ["tv-widget", token, "news"],
    queryFn: () => fn({ data: { token, widget: "news" } }),
    refetchInterval: 5 * 60 * 1000,
  });

  const stats = statsQ.data && statsQ.data.widget === "stats" ? statsQ.data : null;
  const people = atWorkQ.data && atWorkQ.data.widget === "at_work" ? atWorkQ.data.people : [];
  const news = newsQ.data && newsQ.data.widget === "news" ? newsQ.data.items : [];

  const gradients = [
    "linear-gradient(135deg, #6c5ce7, #e84393)",
    "linear-gradient(135deg, #f7931e, #ff6b35)",
    "linear-gradient(135deg, #ff6b35, #6c5ce7)",
    "linear-gradient(135deg, #e84393, #f7931e)",
  ];

  return (
    <aside className="tv-sidebar">
      <div>
        <div className="tv-side-label">V showroomu dnes</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="tv-side-card">
            <div className="tv-stat-val" style={{ color: "#f7931e" }}>{stats?.day.vykupy ?? 0}</div>
            <div className="tv-stat-lbl">Nové výkupy dnes</div>
          </div>
          <div className="tv-side-card">
            <div className="tv-stat-val">{stats?.day.ukoly_done ?? 0}</div>
            <div className="tv-stat-lbl">Hotové úkoly</div>
          </div>
          <div className="tv-side-card">
            <div className="tv-stat-val" style={{ color: "#e84393" }}>{stats?.week.vykupy ?? 0}</div>
            <div className="tv-stat-lbl">Výkupy / týden</div>
          </div>
          <div className="tv-side-card">
            <div className="tv-stat-val" style={{ color: "#6c5ce7" }}>{stats?.week.prodano ?? 0}</div>
            <div className="tv-stat-lbl">Prodáno / týden</div>
          </div>
        </div>
      </div>

      <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div className="tv-side-label">Kdo je právě v práci</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          {people.length ? people.slice(0, 4).map((p, i) => (
            <div key={i} className="tv-person-row">
              <div className="tv-avatar" style={{ background: gradients[i % gradients.length] }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 12, opacity: 0.5 }}>Online</div>
              </div>
              <div className="tv-live-dot" />
            </div>
          )) : (
            <div style={{ fontSize: 14, opacity: 0.5, padding: "8px 0" }}>Nikdo aktuálně nepracuje</div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: "auto",
        padding: 24,
        background: "linear-gradient(135deg, rgba(255,107,53,0.2), rgba(232,67,147,0.15))",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 24,
      }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>
          Aktuality
        </div>
        {news[0] ? (
          <>
            <div style={{ fontFamily: "'Space Grotesk', system-ui", fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
              {news[0].title}
            </div>
            {news[0].body && (
              <div style={{ fontSize: 14, opacity: 0.7, marginTop: 6 }}>{news[0].body}</div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 14, opacity: 0.6 }}>Zatím žádné novinky</div>
        )}
      </div>
    </aside>
  );
}

