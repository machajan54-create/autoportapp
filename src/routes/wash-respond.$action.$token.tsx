import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Car,
  CalendarDays,
  Hash,
  User,
  Clock,
} from "lucide-react";
import { respondToWashAssignment } from "@/lib/evidence.functions";
import autoportLogo from "@/assets/autoport-logo.png.asset.json";

export const Route = createFileRoute("/wash-respond/$action/$token")({
  component: WashRespondPage,
});

type State =
  | { kind: "loading" }
  | { kind: "ok"; status: string; alreadyDecided: boolean; order: any; washer: any }
  | { kind: "error"; message: string };

function fmtDate(v?: string | null) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return v;
  }
}

function WashRespondPage() {
  const { action, token } = Route.useParams();
  const respond = useServerFn(respondToWashAssignment);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (action !== "accept" && action !== "decline") {
      setState({ kind: "error", message: "Neplatná akce." });
      return;
    }
    respond({ data: { token, action: action as "accept" | "decline" } })
      .then((r: any) => {
        if (!r?.ok) {
          setState({ kind: "error", message: "Odkaz není platný nebo již vypršel." });
          return;
        }
        setState({
          kind: "ok",
          status: r.status,
          alreadyDecided: !!r.alreadyDecided,
          order: r.order,
          washer: r.washer,
        });
      })
      .catch((e: any) =>
        setState({ kind: "error", message: e?.message ?? "Něco se pokazilo." }),
      );
  }, [action, token]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-4">
        <div className="mx-auto flex max-w-md items-center justify-center">
          <img
            src={autoportLogo.url}
            alt="Autoport APP"
            className="h-8 w-auto object-contain"
          />
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center p-6">
        {state.kind === "loading" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Zpracovávám odpověď…</p>
          </div>
        )}

        {state.kind === "error" && (
          <div className="w-full space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Něco se nepovedlo
              </h1>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Zpět na Autoport APP
            </Link>
          </div>
        )}

        {state.kind === "ok" && (
          <div className="w-full space-y-6">
            {/* Status hero */}
            <div className="flex flex-col items-center gap-4 text-center">
              {state.status === "accepted" ? (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-10 w-10 text-green-700" />
                </div>
              ) : state.status === "declined" ? (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-10 w-10 text-red-700" />
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
                </div>
              )}

              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {state.alreadyDecided
                    ? "Toto rozhodnutí už máme zaevidované"
                    : state.status === "accepted"
                      ? "Mytí přijato"
                      : state.status === "declined"
                        ? "Mytí odmítnuto"
                        : "Stav zaznamenán"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {state.alreadyDecided
                    ? "Vaše odpověď byla v systému uložena dříve."
                    : state.status === "accepted"
                      ? "Děkujeme za potvrzení, mytí je přiřazeno vám."
                      : state.status === "declined"
                        ? "Rozumíme, zakázka bude nabídnuta jinému myči."
                        : "Váš výběr byl uložen."}
                </p>
              </div>
            </div>

            {/* Order card */}
            {state.order && (
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  <Car className="h-4 w-4" />
                  Detaily zakázky
                </div>
                <div className="space-y-3">
                  <DetailRow
                    icon={<User className="h-4 w-4" />}
                    label="Klient"
                    value={state.order.klient}
                  />
                  <DetailRow
                    icon={<Car className="h-4 w-4" />}
                    label="Vozidlo"
                    value={state.order.vozidlo}
                  />
                  {state.order.vis && (
                    <DetailRow
                      icon={<Hash className="h-4 w-4" />}
                      label="VIS / SPZ"
                      value={state.order.vis}
                    />
                  )}
                  {(state.order.den || state.order.hodina) && (
                    <DetailRow
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Termín"
                      value={
                        [fmtDate(state.order.den), state.order.hodina]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
                    />
                  )}
                  {state.order.cislo_zakazky && (
                    <DetailRow
                      icon={<Hash className="h-4 w-4" />}
                      label="Č. zakázky"
                      value={state.order.cislo_zakazky}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Washer note */}
            {state.washer?.name && (
              <p className="text-center text-xs text-muted-foreground">
                Myč: <span className="font-medium text-foreground">{state.washer.name}</span>
              </p>
            )}

            <div className="flex justify-center">
              <Link
                to="/"
                className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Zpět na Autoport APP
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}
