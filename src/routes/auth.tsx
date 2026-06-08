import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoUser } from "@/lib/claims.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Přihlášení" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const ensureDemo = useServerFn(ensureDemoUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
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
    toast.success("Účet vytvořen. Můžete se přihlásit.");
  }

  async function demo() {
    setBusy(true);
    try {
      const creds = await ensureDemo({});
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.email, password: creds.password,
      });
      if (error) throw error;
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F172A] p-8 shadow-2xl">
        <div className="flex items-center gap-3 text-lg font-semibold text-white">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#F97316" }}
          >
            <Car className="h-5 w-5 text-white" />
          </span>
          <div className="flex flex-col leading-tight">
            <span>AutoPort</span>
            <span className="text-xs font-normal text-slate-400">Interní systém</span>
          </div>
        </div>

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
            </form>
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