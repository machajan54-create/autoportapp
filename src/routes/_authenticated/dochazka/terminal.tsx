import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Delete, ArrowLeft, LogIn, LogOut } from "lucide-react";
import { listShifts, terminalCheckIn } from "@/lib/dochazka.functions";
import { shiftClasses } from "@/lib/dochazka";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dochazka/terminal")({
  component: TerminalPage,
});

function TerminalPage() {
  const [pin, setPin] = useState("");
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState<null | {
    action: "checked_in" | "checked_out";
    name: string;
  }>(null);

  const fetchShifts = useServerFn(listShifts);
  const submit = useServerFn(terminalCheckIn);

  const { data: shifts } = useQuery({ queryKey: ["dochazka", "shifts"], queryFn: () => fetchShifts({}) });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!lastAction) return;
    const t = setTimeout(() => setLastAction(null), 4000);
    return () => clearTimeout(t);
  }, [lastAction]);

  function press(digit: string) {
    if (pin.length >= 8) return;
    setPin((p) => p + digit);
  }
  function backspace() {
    setPin((p) => p.slice(0, -1));
  }

  async function send() {
    if (pin.length < 4) {
      toast.error("Zadejte alespoň 4 číslice");
      return;
    }
    setBusy(true);
    try {
      const r = await submit({ data: { pin, shift_id: shiftId } });
      setLastAction({ action: r.action, name: r.employee.name });
      setPin("");
    } catch (e: any) {
      toast.error(e?.message ?? "Chyba");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 p-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between py-3">
        <Link to="/dochazka" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zpět do administrace
        </Link>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" />
          {now.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      <div className="mx-auto mt-4 grid max-w-5xl gap-6 md:grid-cols-2">
        {/* Left: time + last action */}
        <Card className="flex flex-col items-center justify-center gap-6 bg-white p-8 shadow-lg">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Aktuální čas</p>
            <p className="mt-2 font-mono text-6xl font-bold tabular-nums tracking-tight md:text-7xl">
              {now.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>

          {lastAction ? (
            <div
              className={cn(
                "w-full rounded-xl border-2 p-6 text-center transition-all",
                lastAction.action === "checked_in"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-sky-300 bg-sky-50 text-sky-800",
              )}
            >
              <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white shadow">
                {lastAction.action === "checked_in" ? (
                  <LogIn className="h-6 w-6" />
                ) : (
                  <LogOut className="h-6 w-6" />
                )}
              </div>
              <p className="text-lg font-semibold">{lastAction.name}</p>
              <p className="text-sm">
                {lastAction.action === "checked_in" ? "Příchod zaznamenán" : "Odchod zaznamenán"}
              </p>
            </div>
          ) : (
            <div className="w-full rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-muted-foreground">
              Zadejte svůj PIN pro píchnutí příchodu nebo odchodu.
            </div>
          )}

          {/* Shift picker */}
          <div className="w-full">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Směna (volitelné)
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShiftId(null)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  shiftId === null ? "border-primary bg-primary text-primary-foreground" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                )}
              >
                Bez směny
              </button>
              {(shifts ?? []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setShiftId(s.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    shiftId === s.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : shiftClasses(s.color) + " hover:opacity-80",
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Right: keypad */}
        <Card className="bg-white p-8 shadow-lg">
          <div className="mb-4 flex h-16 items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 font-mono text-3xl tracking-[0.5em]">
            {pin ? "•".repeat(pin.length) : <span className="text-base text-muted-foreground tracking-normal">PIN</span>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                onClick={() => press(String(n))}
                className="h-16 rounded-xl border border-slate-200 bg-slate-50 text-2xl font-semibold text-slate-800 transition hover:bg-slate-100 active:scale-95"
              >
                {n}
              </button>
            ))}
            <button
              onClick={backspace}
              className="flex h-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 active:scale-95"
              aria-label="Smazat"
            >
              <Delete className="h-6 w-6" />
            </button>
            <button
              onClick={() => press("0")}
              className="h-16 rounded-xl border border-slate-200 bg-slate-50 text-2xl font-semibold text-slate-800 transition hover:bg-slate-100 active:scale-95"
            >
              0
            </button>
            <button
              onClick={() => setPin("")}
              className="h-16 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-95"
            >
              C
            </button>
          </div>
          <Button
            disabled={busy || pin.length < 4}
            onClick={send}
            className="mt-4 h-14 w-full text-lg font-semibold"
          >
            {busy ? "Odesílám…" : "Potvrdit"}
          </Button>
        </Card>
      </div>
    </div>
  );
}