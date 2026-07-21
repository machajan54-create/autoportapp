import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/feedback/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Napište nám — Autoport" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { token } = Route.useParams();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 1) { setErrMsg("Prosím napište zprávu."); return; }
    if (trimmed.length > 2000) { setErrMsg("Zpráva je příliš dlouhá (max 2000 znaků)."); return; }
    setStatus("sending"); setErrMsg(null);
    const { error } = await supabase.from("tv_feedback").insert({
      token,
      name: name.trim().slice(0, 100) || null,
      contact: contact.trim().slice(0, 200) || null,
      message: trimmed,
    });
    if (error) {
      setStatus("err");
      setErrMsg("Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.");
      return;
    }
    setStatus("ok");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)",
      color: "white",
      fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "24px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✉️</div>
          <h1 style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: 0,
          }}>Napište nám</h1>
          <p style={{ opacity: 0.7, marginTop: 8, fontSize: 15 }}>
            Máte dotaz nebo zpětnou vazbu? Rádi si ji přečteme.
          </p>
        </div>

        {status === "ok" ? (
          <div style={{
            padding: 28, borderRadius: 16, textAlign: "center",
            background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Děkujeme!</div>
            <div style={{ opacity: 0.75, marginTop: 6, fontSize: 14 }}>
              Zprávu jsme obdrželi a ozveme se vám co nejdříve.
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{
            display: "flex", flexDirection: "column", gap: 14,
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, padding: 20,
          }}>
            <Field label="Jméno (nepovinné)">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
                style={inputStyle} placeholder="Vaše jméno" />
            </Field>
            <Field label="Kontakt – e-mail nebo telefon (nepovinné)">
              <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200}
                style={inputStyle} placeholder="např. jan@example.cz" />
            </Field>
            <Field label="Zpráva">
              <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                maxLength={2000} rows={6}
                style={{ ...inputStyle, resize: "vertical", minHeight: 140, fontFamily: "inherit" }}
                placeholder="Napište nám cokoli…" />
              <div style={{ fontSize: 11, opacity: 0.5, textAlign: "right", marginTop: 4 }}>
                {message.length}/2000
              </div>
            </Field>

            {errMsg && <div style={{ fontSize: 14, color: "#fca5a5" }}>{errMsg}</div>}

            <button type="submit" disabled={status === "sending"} style={{
              padding: "14px 22px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #ff6b35, #e84393)",
              color: "white", cursor: status === "sending" ? "wait" : "pointer",
              fontFamily: "inherit", fontSize: 16, fontWeight: 700,
              opacity: status === "sending" ? 0.7 : 1,
              boxShadow: "0 10px 30px rgba(232,67,147,0.35)",
            }}>{status === "sending" ? "Odesílám…" : "Odeslat zprávu"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "14px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 16,
  outline: "none",
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
};