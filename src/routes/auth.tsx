import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import autoportLogo from "@/assets/autoport-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/claims.functions";
import { ensureDemoUser } from "@/lib/demo.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Přihlášení" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getMyAccess);
  const ensureDemo = useServerFn(ensureDemoUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      try {
        const acc = await fetchAccess({});
        navigate({ to: acc.isAdmin ? "/dashboard" : "/admin" });
      } catch {
        navigate({ to: "/admin" });
      }
    });
  }, [navigate, fetchAccess]);

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
      setBusy(false);
      navigate({ to: acc.isAdmin ? "/dashboard" : "/admin" });
      return;
    } catch (e) {
      setBusy(false);
      return toast.error((e as Error).message);
    }
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

  async function demoLogin() {
    setBusy(true);
    try {
      const { email: demoEmail, password: demoPassword } = await ensureDemo({});
      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });
      if (error) throw error;
      try {
        const acc = await fetchAccess({});
        navigate({ to: acc.isAdmin ? "/dashboard" : "/admin" });
      } catch {
        navigate({ to: "/admin" });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(249,115,22,0.10), transparent 60%), linear-gradient(135deg, #0B1220 0%, #0F172A 60%, #111827 100%)",
      }}
    >
      <div className="w-full max-w-[440px]">
        {/* Brand header */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-white px-6 py-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)]">
            <img
              src={autoportLogo.url}
              alt="Autoport APP"
              className="h-10 w-auto object-contain"
            />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Interní systém 2026
          </p>
        </div>

        {/* Auth card */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur">
          <div className="px-7 pb-2 pt-7">
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-950/70 p-1">
                <TabsTrigger
                  value="login"
                  className="rounded-lg text-sm font-semibold text-slate-300 data-[state=active]:bg-[#F97316] data-[state=active]:text-white data-[state=active]:shadow-md"
                >
                  Přihlášení
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="rounded-lg text-sm font-semibold text-slate-300 data-[state=active]:bg-[#F97316] data-[state=active]:text-white data-[state=active]:shadow-md"
                >
                  Registrace
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                {resetMode ? (
                  <form onSubmit={sendReset} className="mt-6 space-y-4">
                    <div>
                      <Label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        E-mail pro reset hesla
                      </Label>
                      <Input
                        type="email"
                        className="h-11 rounded-xl border-slate-800 bg-slate-950 text-white placeholder:text-slate-600 focus-visible:border-[#F97316]/60 focus-visible:ring-[#F97316]/40"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="h-12 w-full rounded-xl text-white shadow-lg shadow-orange-500/20 hover:opacity-90"
                      style={{ backgroundColor: "#F97316" }}
                      disabled={busy}
                    >
                      Odeslat odkaz pro reset
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl border-slate-800 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                      onClick={() => setResetMode(false)}
                    >
                      Zpět na přihlášení
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={signIn} className="mt-6 space-y-4">
                    <div>
                      <Label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        E-mail
                      </Label>
                      <Input
                        type="email"
                        placeholder="jmeno@autoport.cz"
                        className="h-11 rounded-xl border-slate-800 bg-slate-950 text-white placeholder:text-slate-600 focus-visible:border-[#F97316]/60 focus-visible:ring-[#F97316]/40"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Heslo
                      </Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-11 rounded-xl border-slate-800 bg-slate-950 text-white placeholder:text-slate-600 focus-visible:border-[#F97316]/60 focus-visible:ring-[#F97316]/40"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg shadow-orange-500/20 transition-transform hover:opacity-95 active:scale-[0.99]"
                      style={{ backgroundColor: "#F97316" }}
                      disabled={busy}
                    >
                      Přihlásit se
                    </Button>
                    <button
                      type="button"
                      onClick={() => setResetMode(true)}
                      className="block w-full text-center text-xs text-slate-400 transition-colors hover:text-orange-400"
                    >
                      Zapomenuté heslo?
                    </button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={signUp} className="mt-6 space-y-4">
                  <div>
                    <Label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      E-mail
                    </Label>
                    <Input
                      type="email"
                      placeholder="jmeno@autoport.cz"
                      className="h-11 rounded-xl border-slate-800 bg-slate-950 text-white placeholder:text-slate-600 focus-visible:border-[#F97316]/60 focus-visible:ring-[#F97316]/40"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Heslo
                    </Label>
                    <Input
                      type="password"
                      placeholder="Alespoň 6 znaků"
                      className="h-11 rounded-xl border-slate-800 bg-slate-950 text-white placeholder:text-slate-600 focus-visible:border-[#F97316]/60 focus-visible:ring-[#F97316]/40"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg shadow-orange-500/20 hover:opacity-95"
                    style={{ backgroundColor: "#F97316" }}
                    disabled={busy}
                  >
                    Vytvořit účet
                  </Button>
                  <p className="text-center text-xs text-slate-500">
                    Po registraci čeká účet na schválení super adminem.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          {/* Demo footer */}
          {!resetMode && (
            <div className="border-t border-white/5 bg-slate-950/60 px-7 py-5">
              <div className="rounded-xl border border-dashed border-slate-700/80 p-4">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Demo přístup
                </p>
                <p className="mt-2 text-center text-xs text-slate-300">
                  <span className="font-medium">demo@autoport.app</span>
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="font-medium">Demo1234!</span>
                </p>
                <Button
                  type="button"
                  onClick={demoLogin}
                  disabled={busy}
                  variant="outline"
                  className="mt-3 h-10 w-full rounded-lg border-slate-700 bg-transparent text-sm font-semibold text-slate-100 hover:bg-slate-800 hover:text-white"
                >
                  Přihlásit jako demo
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-slate-400 transition-colors hover:text-white"
          >
            ← Zpět na úvod
          </Link>
        </div>
      </div>
    </div>
  );
}