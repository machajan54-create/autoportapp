import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { getTvWidgetData, type TvWidgetResult } from "@/lib/tv-widgets.functions";

export type TvSlide = {
  id: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  type: string;
  kind: "image" | "video" | "youtube" | "rich_text" | "web_url" | "data_widget" | "feedback_qr";
  payload: Record<string, unknown>;
  duration_sec: number;
  transition: string;
  weight: number;
  sort_order: number;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
};

async function resolveStorageUrl(raw: string | null, bucket = "slides"): Promise<string | null> {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(raw, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

function useSignedUrl(raw: string | null, bucket = "slides") {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    resolveStorageUrl(raw, bucket).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [raw, bucket]);
  return url;
}

export function SlideRenderer({ slide, token, active, onFinished }: {
  slide: TvSlide; token: string; active: boolean; onFinished?: () => void;
}) {
  switch (slide.kind) {
    case "video":
      return <VideoSlide slide={slide} active={active} onFinished={onFinished} />;
    case "youtube":
      return <YouTubeSlide slide={slide} active={active} />;
    case "rich_text":
      return <RichTextSlide slide={slide} active={active} />;
    case "web_url":
      return <WebUrlSlide slide={slide} active={active} />;
    case "data_widget":
      return <DataWidgetSlide slide={slide} token={token} active={active} />;
    case "feedback_qr":
      return <FeedbackQrSlide slide={slide} token={token} active={active} />;
    case "image":
    default:
      return <ImageSlide slide={slide} active={active} />;
  }
}

/* ---------- Feedback QR ---------- */
function FeedbackQrSlide({ slide, token, active }: { slide: TvSlide; token: string; active: boolean }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/feedback/${encodeURIComponent(token)}`;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 640,
      color: { dark: "#0b0f1a", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [token]);

  const title = slide.title || "Napište nám";
  const subtitle = slide.subtitle || "Vaše zpětná vazba nás posouvá dál";
  const body = slide.body || "Naskenujte QR kód mobilem a otevře se krátký formulář.";

  return (
    <div className="tv-layer" data-active={active}>
      <div
        className="tv-bg"
        style={{
          background:
            "radial-gradient(ellipse at 20% 20%, hsl(24 95% 22%) 0%, hsl(220 60% 8%) 55%, hsl(220 70% 5%) 100%)",
        }}
      />
      <div
        className="tv-content"
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "6% 6%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 90,
            maxWidth: 1600,
          }}
        >
          <div
            style={{
              width: 520,
              height: 520,
              background: "white",
              borderRadius: 40,
              padding: 32,
              boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR kód pro zpětnou vazbu"
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            ) : (
              <div style={{ color: "#0b0f1a", opacity: 0.4, fontSize: 24 }}>QR…</div>
            )}
          </div>
          <div style={{ textAlign: "left", color: "white" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "hsl(24 95% 65%)",
                marginBottom: 20,
              }}
            >
              Zpětná vazba
            </div>
            <h1
              className="tv-title"
              style={{ marginBottom: 20, fontSize: 96, lineHeight: 1.05 }}
            >
              {title}
            </h1>
            <div
              className="tv-subtitle"
              style={{ marginBottom: 28, opacity: 0.9 }}
            >
              {subtitle}
            </div>
            <div className="tv-body" style={{ maxWidth: 720, opacity: 0.8 }}>
              {body}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Image (legacy) ---------- */
function ImageSlide({ slide, active }: { slide: TvSlide; active: boolean }) {
  const url = useSignedUrl(slide.image_url);
  return (
    <div className="tv-layer" data-active={active}>
      {url && (
        <div
          className="tv-bg"
          style={{
            backgroundImage: `url(${url})`,
            animation: active && slide.transition === "kenburns"
              ? `tv-kenburns ${(slide.duration_sec + 4) * 1000}ms ease-out forwards`
              : "none",
          }}
        />
      )}
      <div
        className="tv-vignette"
        style={{
          background: url
            ? "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.78) 100%)"
            : "radial-gradient(ellipse at center, hsl(220 40% 18%) 0%, hsl(220 45% 8%) 100%)",
        }}
      />
      <SlideText slide={slide} />
    </div>
  );
}

/* ---------- Rich text ---------- */
function RichTextSlide({ slide, active }: { slide: TvSlide; active: boolean }) {
  const p = slide.payload as { bullets?: string[]; align?: "left" | "center"; accent?: string; bg?: string };
  const bg = p.bg || "linear-gradient(135deg, hsl(220 55% 12%), hsl(220 60% 6%))";
  return (
    <div className="tv-layer" data-active={active}>
      <div className="tv-bg" style={{ background: bg }} />
      <div className="tv-content" style={{ justifyContent: "center", alignItems: p.align === "center" ? "center" : "flex-start", textAlign: p.align ?? "left" }}>
        {slide.title && <h1 className="tv-title">{slide.title}</h1>}
        {slide.subtitle && <div className="tv-subtitle">{slide.subtitle}</div>}
        {slide.body && <div className="tv-body">{slide.body}</div>}
        {p.bullets && p.bullets.length > 0 && (
          <ul className="tv-bullets">
            {p.bullets.map((b, i) => (
              <li key={i}><span className="tv-bullet-dot" style={{ background: p.accent || "hsl(24 95% 55%)" }} />{b}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- Video ---------- */
function VideoSlide({ slide, active, onFinished }: { slide: TvSlide; active: boolean; onFinished?: () => void }) {
  const p = slide.payload as { storage_path?: string; url?: string; loop?: boolean };
  const url = useSignedUrl(p.storage_path ?? null);
  const src = url || p.url || null;
  return (
    <div className="tv-layer" data-active={active}>
      {src ? (
        <video
          src={src}
          autoPlay={active}
          muted
          playsInline
          loop={!!p.loop}
          onEnded={() => { if (!p.loop) onFinished?.(); }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "black" }}
        />
      ) : (
        <div className="tv-bg" style={{ background: "black" }} />
      )}
      <div className="tv-vignette" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)" }} />
      <SlideText slide={slide} />
    </div>
  );
}

/* ---------- YouTube ---------- */
function YouTubeSlide({ slide, active }: { slide: TvSlide; active: boolean }) {
  const p = slide.payload as { video_id?: string };
  const id = p.video_id || "";
  const src = id
    ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=${active ? 1 : 0}&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1&loop=1&playlist=${id}`
    : null;
  return (
    <div className="tv-layer" data-active={active}>
      {src && active && (
        <iframe
          key={active ? "on" : "off"}
          src={src}
          title={slide.title ?? "YouTube"}
          allow="autoplay; encrypted-media"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      )}
      {!active && <div className="tv-bg" style={{ background: "black" }} />}
    </div>
  );
}

/* ---------- Web URL ---------- */
function WebUrlSlide({ slide, active }: { slide: TvSlide; active: boolean }) {
  const p = slide.payload as { url?: string };
  return (
    <div className="tv-layer" data-active={active}>
      {p.url && active ? (
        <iframe
          src={p.url}
          title={slide.title ?? "Web"}
          sandbox="allow-scripts allow-same-origin allow-popups"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, background: "white" }}
        />
      ) : (
        <div className="tv-bg" style={{ background: "#111" }} />
      )}
    </div>
  );
}

/* ---------- Widget ---------- */
function DataWidgetSlide({ slide, token, active }: { slide: TvSlide; token: string; active: boolean }) {
  const p = slide.payload as { widget?: "stats" | "at_work" | "vehicles" | "news" | "weather" };
  const widget = p.widget ?? "stats";
  const [data, setData] = useState<TvWidgetResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getTvWidgetData({ data: { token, widget } });
        if (!cancelled) { setData(r); setErr(null); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    const t = setInterval(async () => {
      try {
        const r = await getTvWidgetData({ data: { token, widget } });
        if (!cancelled) setData(r);
      } catch { /* keep last */ }
    }, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [active, token, widget]);

  return (
    <div className="tv-layer" data-active={active}>
      <div className="tv-bg" style={{ background: "linear-gradient(135deg, hsl(220 55% 12%), hsl(220 60% 6%))" }} />
      <div className="tv-content" style={{ padding: "6% 5% 8%", justifyContent: "flex-start" }}>
        {slide.title && <h1 className="tv-title" style={{ marginBottom: 32 }}>{slide.title}</h1>}
        {err && <div className="tv-body" style={{ opacity: 0.6 }}>Data se nepodařilo načíst.</div>}
        {!err && !data && <div className="tv-body" style={{ opacity: 0.6 }}>Načítám…</div>}
        {data?.widget === "stats" && <StatsView d={data} />}
        {data?.widget === "at_work" && <AtWorkView d={data} />}
        {data?.widget === "vehicles" && <VehiclesView d={data} />}
        {data?.widget === "news" && <NewsView d={data} />}
        {data?.widget === "weather" && <WeatherView d={data} />}
      </div>
    </div>
  );
}

function StatsView({ d }: { d: Extract<TvWidgetResult, { widget: "stats" }> }) {
  const cards = [
    { label: "Nové výkupy dnes", value: d.day.vykupy },
    { label: "Prodáno dnes", value: d.day.prodano },
    { label: "Úkoly hotové dnes", value: d.day.ukoly_done },
    { label: "Výkupy tento týden", value: d.week.vykupy },
    { label: "Prodáno tento týden", value: d.week.prodano },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, width: "100%" }}>
      {cards.slice(0, 6).map((c, i) => (
        <div key={i} style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20, padding: 40, minHeight: 220,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <div style={{ fontSize: 24, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.7 }}>{c.label}</div>
          <div style={{ fontSize: 128, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em", color: "hsl(24 95% 60%)" }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function AtWorkView({ d }: { d: Extract<TvWidgetResult, { widget: "at_work" }> }) {
  if (!d.people.length) return <div className="tv-body" style={{ opacity: 0.7 }}>Momentálně nikdo přihlášen.</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 24, width: "100%" }}>
      {d.people.map((p, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 24,
          padding: "20px 28px", borderRadius: 16,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "hsl(24 95% 55%)", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 700,
          }}>{p.name.split(" ").map(x => x[0]).slice(0, 2).join("")}</div>
          <div style={{ fontSize: 34, fontWeight: 600 }}>{p.name}</div>
        </div>
      ))}
    </div>
  );
}

function VehiclesView({ d }: { d: Extract<TvWidgetResult, { widget: "vehicles" }> }) {
  if (!d.vehicles.length) return <div className="tv-body" style={{ opacity: 0.7 }}>Nabídka právě prázdná.</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28, width: "100%" }}>
      {d.vehicles.slice(0, 6).map((v) => (
        <div key={v.id} style={{
          borderRadius: 20, overflow: "hidden",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            aspectRatio: "16/10",
            backgroundImage: v.photo_url ? `url(${v.photo_url})` : undefined,
            backgroundSize: "cover", backgroundPosition: "center",
            background: v.photo_url ? undefined : "rgba(255,255,255,0.05)",
          }} />
          <div style={{ padding: "18px 22px" }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{v.znacka} {v.model}</div>
            <div style={{ fontSize: 22, opacity: 0.8, marginTop: 6 }}>
              {[v.rok_vyroby, v.pocet_km ? `${v.pocet_km.toLocaleString("cs-CZ")} km` : null, v.barva].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsView({ d }: { d: Extract<TvWidgetResult, { widget: "news" }> }) {
  if (!d.items.length) return <div className="tv-body" style={{ opacity: 0.7 }}>Žádné aktuality.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      {d.items.slice(0, 4).map((n) => (
        <div key={n.id} style={{
          padding: "24px 32px", borderRadius: 16,
          background: "rgba(255,255,255,0.06)", borderLeft: "6px solid hsl(24 95% 55%)",
        }}>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{n.title}</div>
          {n.body && <div style={{ fontSize: 22, opacity: 0.85, marginTop: 6 }}>{n.body}</div>}
        </div>
      ))}
    </div>
  );
}

function WeatherView({ d }: { d: Extract<TvWidgetResult, { widget: "weather" }> }) {
  const icon = weatherIcon(d.code);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 60, width: "100%", justifyContent: "center", marginTop: 40 }}>
      <div style={{ fontSize: 240 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 200, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1 }}>
          {d.temp_c != null ? Math.round(d.temp_c) : "–"}°
        </div>
        <div style={{ fontSize: 42, opacity: 0.85, marginTop: 12 }}>{d.city}</div>
      </div>
    </div>
  );
}

function weatherIcon(code: number | null): string {
  if (code == null) return "🌡️";
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "🌤️";
}

/* ---------- Shared text overlay (image/video) ---------- */
function SlideText({ slide }: { slide: TvSlide }) {
  if (!slide.title && !slide.subtitle && !slide.body) return null;
  return (
    <div className="tv-content" style={{ justifyContent: "flex-end", paddingBottom: 140 }}>
      {slide.type && slide.kind === "image" && (
        <div className="tv-badge" style={{ background: badgeColor(slide.type) }}>{badgeLabel(slide.type)}</div>
      )}
      {slide.title && <h1 className="tv-title">{slide.title}</h1>}
      {slide.subtitle && <div className="tv-subtitle">{slide.subtitle}</div>}
      {slide.body && <div className="tv-body" style={{ maxWidth: "70%" }}>{slide.body}</div>}
    </div>
  );
}

function badgeLabel(t: string) {
  return ({ news: "Novinka", promo: "Akce", vehicle: "Vozidlo", video: "Video" } as Record<string, string>)[t] ?? t;
}
function badgeColor(t: string) {
  return ({ news: "#2563eb", promo: "#f97316", vehicle: "#059669", video: "#7c3aed" } as Record<string, string>)[t] ?? "#334155";
}