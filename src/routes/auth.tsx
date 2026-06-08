import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import rocketLogo from "@/assets/rocket-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/claims.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Přihlášení" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getMyAccess);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    try {
      const acc = await fetchAccess({});
      if (!acc.approved) {
        await supabase.auth.signOut();
        setBusy(false);
        return toast.error("Váš účet čeká na schválení super adminem.");
      }
    } catch (e) {
      setBusy(false);
      return toast.error((e as Error).message);
    }
    setBusy(false);
    navigate({ to: "/admin" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password, options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Účet vytvořen. Vyčkejte na schválení super adminem.");
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + "/auth",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pokud účet existuje, odeslali jsme e-mail s instrukcemi.");
    setResetMode(false);
    setResetEmail("");
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F172A] p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <img
            src={rocketLogo}
            alt="Autoport APP logo"
            className="h-16 w-16 object-contain -rotate-12 drop-shadow-[0_8px_20px_rgba(249,115,22,0.45)] transition-transform duration-500 hover:-rotate-6 hover:scale-110 animate-[float_4s_ease-in-out_infinite]"
          />
          <div>
            <h1 className="text-xl font-bold text-white">Interní systém Autoport APP 2026</h1>
          </div>
        </div>
        <style>{`@keyframes float{0%,100%{transform:translateY(0) rotate(-12deg)}50%{transform:translateY(-6px) rotate(-10deg)}}`}</style>

        <Tabs defaultValue="login" className="mt-6">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/60">
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-[#F97316] data-[state=active]:text-white text-slate-300"
            >
              Přihlášení
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="data-[state=active]:bg-[#F97316] data-[state=active]:text-white text-slate-300"
            >
              Registrace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            {resetMode ? (
              <form onSubmit={sendReset} className="mt-4 space-y-4">
                <div>
                  <Label className="text-slate-200">E-mail pro reset hesla</Label>
                  <Input
                    type="email"
                    className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: "#F97316" }}
                  disabled={busy}
                >
                  Odeslat odkaz pro reset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                  onClick={() => setResetMode(false)}
                >
                  Zpět na přihlášení
                </Button>
              </form>
            ) : (
            <form onSubmit={signIn} className="mt-4 space-y-4">
              <div><Label className="text-slate-200">E-mail</Label>
                <Input type="email" className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><Label className="text-slate-200">Heslo</Label>
                <Input type="password" className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              <Button
                type="submit"
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: "#F97316" }}
                disabled={busy}
              >
                Přihlásit se
              </Button>
              <Button type="button" variant="outline" className="w-full border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white" onClick={demo} disabled={busy}>
                Přihlásit se jako demo
              </Button>
              <button
                type="button"
                onClick={() => setResetMode(true)}
                className="block w-full text-center text-xs text-slate-400 underline hover:text-white"
              >
                Zapomenuté heslo?
              </button>
            </form>
            )}
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={signUp} className="mt-4 space-y-4">
              <div><Label className="text-slate-200">E-mail</Label>
                <Input type="email" className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><Label className="text-slate-200">Heslo</Label>
                <Input type="password" className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></div>
              <Button
                type="submit"
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: "#F97316" }}
                disabled={busy}
              >
                Vytvořit účet
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center text-sm">
          <Link to="/" className="text-slate-400 hover:text-white">← Zpět</Link>
        </div>
      </div>
    </div>
  );
}