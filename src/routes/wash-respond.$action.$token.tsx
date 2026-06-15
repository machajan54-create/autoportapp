import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { respondToWashAssignment } from "@/lib/evidence.functions";

export const Route = createFileRoute("/wash-respond/$action/$token")({
  component: WashRespondPage,
});

function WashRespondPage() {
  const { action, token } = Route.useParams();
  const respond = useServerFn(respondToWashAssignment);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; status: string; alreadyDecided: boolean; order: any; washer: any }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      {state.kind === "loading" && <p className="text-muted-foreground">Zpracovávám…</p>}
      {state.kind === "error" && (
        <>
          <h1 className="text-2xl font-semibold">Něco se nepovedlo</h1>
          <p className="text-sm text-muted-foreground">{state.message}</p>
        </>
      )}
      {state.kind === "ok" && (
        <>
          <div
            className={
              "inline-flex items-center justify-center rounded-full px-4 py-1 text-sm font-semibold " +
              (state.status === "accepted"
                ? "bg-green-100 text-green-800"
                : state.status === "declined"
                  ? "bg-red-100 text-red-800"
                  : "bg-slate-100 text-slate-700")
            }
          >
            {state.status === "accepted"
              ? "Mytí přijato"
              : state.status === "declined"
                ? "Mytí odmítnuto"
                : "Stav zaznamenán"}
          </div>
          <h1 className="text-2xl font-semibold">
            {state.alreadyDecided ? "Vaše rozhodnutí už bylo zaevidováno." : "Děkujeme!"}
          </h1>
          {state.order && (
            <div className="rounded-md border bg-card p-4 text-left text-sm">
              <div><strong>Klient:</strong> {state.order.klient}</div>
              <div><strong>Vozidlo:</strong> {state.order.vozidlo}</div>
              {state.order.vis && <div><strong>VIS/SPZ:</strong> {state.order.vis}</div>}
              {state.order.den && <div><strong>Den:</strong> {state.order.den}</div>}
              {state.order.hodina && <div><strong>Hodina:</strong> {state.order.hodina}</div>}
              {state.order.cislo_zakazky && (
                <div><strong>Č. zakázky:</strong> {state.order.cislo_zakazky}</div>
              )}
            </div>
          )}
          <Link to="/" className="text-sm text-primary underline">
            Přejít na hlavní stránku
          </Link>
        </>
      )}
    </main>
  );
}