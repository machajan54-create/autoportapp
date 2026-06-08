import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" /> Pojistné události
        </div>

        <Tabs defaultValue="login" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Přihlášení</TabsTrigger>
            <TabsTrigger value="register">Registrace</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={signIn} className="mt-4 space-y-4">
              <div><Label>E-mail</Label>
                <Input type="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><Label>Heslo</Label>
                <Input type="password" className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              <Button type="submit" className="w-full" disabled={busy}>Přihlásit se</Button>
              <Button type="button" variant="outline" className="w-full" onClick={demo} disabled={busy}>
                Přihlásit se jako demo
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={signUp} className="mt-4 space-y-4">
              <div><Label>E-mail</Label>
                <Input type="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><Label>Heslo</Label>
                <Input type="password" className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></div>
              <Button type="submit" className="w-full" disabled={busy}>Vytvořit účet</Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground">← Zpět</Link>
        </div>
      </div>
    </div>
  );
}