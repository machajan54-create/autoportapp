import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Car } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const type = params.get("type");
    setValid(type === "recovery");
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("Hesla se neshodují.");
    }
    if (password.length < 6) {
      return toast.error("Heslo musí mít alespoň 6 znaků.");
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Heslo bylo úspěšně změněno.");
    navigate({ to: "/" });
  }

  if (valid === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] text-white">
        Načítání…
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0F172A] px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F172A] p-8 shadow-2xl text-center">
          <h1 className="text-xl font-bold">Neplatný odkaz</h1>
          <p className="mt-2 text-slate-400">Odkaz pro reset hesla je neplatný nebo vypršel.</p>
          <Link to="/" className="mt-4 inline-block text-[#F97316] hover:underline">
            Zpět na přihlášení
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4"
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
            <span className="text-xs font-normal text-slate-400">Nové heslo</span>
          </div>
        </div>

        <form onSubmit={handleReset} className="mt-6 space-y-4">
          <div>
            <Label className="text-slate-200">Nové heslo</Label>
            <Input
              type="password"
              className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div>
            <Label className="text-slate-200">Potvrzení hesla</Label>
            <Input
              type="password"
              className="mt-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            Nastavit nové heslo
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link to="/" className="text-slate-400 hover:text-white">
            ← Zpět na přihlášení
          </Link>
        </div>
      </div>
    </div>
  );
}
