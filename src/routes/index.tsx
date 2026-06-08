import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Car, Phone, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/claims.functions";
import { toast } from "sonner";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Autoport APP — Přihlášení" },
      {
        name: "description",
        content:
          "Přihlášení do interního systému Autoport APP. Správa pojistných událostí a výkupů.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getMyAccess);
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
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Účet vytvořen. Vyčkejte na schválení super adminem.");
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 pb-28 sm:pb-4"
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
            <span>Autoport APP</span>
            <span className="text-xs font-normal text-slate-400">Interní systém 2026</span>
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
              <div>
                <Label className="text-slate-200">E-mail</Label>
                <Input
                  type="email"
                  className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="text-slate-200">Heslo</Label>
                <Input
                  type="password"
                  className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: "#F97316" }}
                disabled={busy}
              >
                Přihlásit se
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={signUp} className="mt-4 space-y-4">
              <div>
                <Label className="text-slate-200">E-mail</Label>
                <Input
                  type="email"
                  className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="text-slate-200">Heslo</Label>
                <Input
                  type="password"
                  className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
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
          <Link to="/nahlasit" className="text-slate-400 hover:text-white">
            Nahlásit pojistnou událost →
          </Link>
        </div>
      </div>

      {/* Klientská sekce mimo přihlašovací kartu */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0B1220]/95 backdrop-blur px-4 py-3 sm:static sm:mt-6 sm:w-full sm:max-w-md sm:rounded-2xl sm:border sm:bg-[#0F172A] sm:p-5">
        <p className="text-center text-xs uppercase tracking-wide text-slate-400">
          Měli jste nehodu? Jsme tu pro vás
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <a
            href="tel:+420800100200"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg"
            style={{ backgroundColor: "#F97316" }}
          >
            <Phone className="h-4 w-4" />
            Zavolat +420 800 100 200
          </a>
          <Link
            to="/nahlasit"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <FileWarning className="h-4 w-4" />
            Nahlásit událost
          </Link>
        </div>
      </div>
    </div>
  );
}
