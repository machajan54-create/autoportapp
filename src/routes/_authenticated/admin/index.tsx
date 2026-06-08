import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listClaims } from "@/lib/claims.functions";
import {
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  Plus,
  Search,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminList,
});

type FilterKey = "all" | "new" | "in_repair" | "waiting_vat" | "done";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Všechny" },
  { key: "new", label: "Nové" },
  { key: "in_repair", label: "V opravě" },
  { key: "waiting_vat", label: "Čeká na DPH" },
  { key: "done", label: "Dokončené" },
];

const statusMeta: Record<string, { label: string; cls: string }> = {
  new: { label: "Nová", cls: "bg-primary/10 text-primary border-primary/20" },
  in_progress: { label: "V opravě", cls: "bg-amber-100 text-amber-900 border-amber-200" },
  in_repair: { label: "V opravě", cls: "bg-amber-100 text-amber-900 border-amber-200" },
  waiting_vat: { label: "Čeká na DPH", cls: "bg-violet-100 text-violet-900 border-violet-200" },
  closed: { label: "Dokončeno", cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  done: { label: "Dokončeno", cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
};

function isActive(s: string) {
  return s !== "done" && s !== "closed";
}

function AdminList() {
  const navigate = useNavigate();
  const fetch = useServerFn(listClaims);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["claims"],
    queryFn: () => fetch({}),
  });
  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");

  const rows = (data ?? []).filter((c) => {
    if (filter === "new" && c.status !== "new") return false;
    if (filter === "in_repair" && c.status !== "in_repair" && c.status !== "in_progress")
      return false;
    if (filter === "waiting_vat" && c.status !== "waiting_vat") return false;
    if (filter === "done" && c.status !== "done" && c.status !== "closed") return false;
    if (q.trim()) {
      const term = q.toLowerCase();
      const hay = `${c.first_name} ${c.last_name} ${c.insurer ?? ""} ${c.claim_number ?? ""} ${c.pu_number ?? ""}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const stats = {
    active: (data ?? []).filter((c) => isActive(c.status)).length,
    unpaidVat: (data ?? []).filter((c) => !c.vat_paid && isActive(c.status)).length,
    total: data?.length ?? 0,
  };

  return (
    <AdminShell requireModule="claims">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Klientský servis
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Pojistné události</h1>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Aktivní zakázky"
            value={stats.active}
            icon={<FolderOpen className="h-5 w-5 text-primary" />}
            tint="bg-primary/10"
          />
          <StatCard
            label="Neuhrazené DPH"
            value={stats.unpaidVat}
            icon={<AlertCircle className="h-5 w-5 text-rose-600" />}
            tint="bg-rose-100"
          />
          <StatCard
            label="Celkem v databázi"
            value={stats.total}
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            tint="bg-emerald-100"
          />
          <Link
            to="/nahlasit"
            className="flex items-center justify-between rounded-xl bg-orange-500 p-5 text-white shadow-sm transition hover:bg-orange-600"
          >
            <span className="text-lg font-semibold leading-tight">
              Zadat pojistnou
              <br />
              událost
            </span>
            <Plus className="h-6 w-6" />
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat…"
              className="h-9 w-40 pl-8 sm:w-56"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-9 w-9"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RotateCcw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>

        <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Složky zakázek ({rows.length})
        </h2>
        <div className="mt-3 space-y-3">
          {isLoading && <div className="text-sm text-muted-foreground">Načítám…</div>}
          {!isLoading && rows.length === 0 && (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Žádné zakázky.
            </div>
          )}
          {rows.map((c) => {
            const meta = statusMeta[c.status] ?? statusMeta.new;
            return (
              <button
                key={c.id}
                onClick={() => navigate({ to: "/admin/$id", params: { id: c.id } })}
                className="group flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-2 py-0.5 font-mono">
                      {c.pu_number ?? "—"}
                    </span>
                    <span>{new Date(c.created_at).toLocaleDateString("cs-CZ")}</span>
                    <span className={cn("ml-auto rounded-md border px-2 py-0.5 text-xs font-medium", meta.cls)}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="font-semibold">{c.insurer || "—"}</div>
                  <div className="text-sm text-muted-foreground">
                    Majitel: <span className="text-foreground">{c.first_name} {c.last_name}</span>
                  </div>
                  {c.claim_number && (
                    <div className="text-xs text-muted-foreground">Číslo škodní: {c.claim_number}</div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </button>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
      </div>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tint)}>{icon}</div>
    </div>
  );
}