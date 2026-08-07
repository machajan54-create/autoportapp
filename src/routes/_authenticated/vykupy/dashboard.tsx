import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { listVykupy, formatKc, formatDate, marze, type Vykup } from "@/lib/vykupy";
import { listEmployees } from "@/lib/claims.functions";
import {
  Car,
  Coins,
  TrendingUp,
  TrendingDown,
  Clock,
  Award,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/vykupy/dashboard")({
  component: VykupyDashboard,
});

type Period = "30d" | "90d" | "ytd" | "all";

function VykupyDashboard() {
  const fetchEmployees = useServerFn(listEmployees);
  const { data: vykupy, isLoading } = useQuery({ queryKey: ["vykupy"], queryFn: listVykupy });
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => fetchEmployees({}),
  });
  const [period, setPeriod] = useState<Period>("90d");

  const filtered = useMemo(() => filterByPeriod(vykupy ?? [], period), [vykupy, period]);

  const prodano = filtered.filter((v) => v.stav === "Prodáno");
  const vykoupeno = filtered.filter((v) => v.stav === "Vykoupeno");
  const naceneni = filtered.filter((v) => v.stav === "Nacenění");
  const zamitnuto = filtered.filter((v) => v.stav === "Zamítnuto");

  const obrat = sum(prodano.map((v) => v.prodano_za ?? 0));
  const marzeTotal = sum(prodano.map((v) => marze(v) ?? 0));
  const avgMarze = prodano.length ? marzeTotal / prodano.length : 0;
  const marzePct = obrat > 0 ? (marzeTotal / obrat) * 100 : 0;
  const vazanyKapital = sum(vykoupeno.map((v) => v.vykoupeno_za ?? 0));

  const byZnacka = groupBy(prodano, (v) => v.znacka || "Neznámá");
  const byZdroj = groupBy(filtered, (v) => v.zdroj || "Neuvedeno");
  const byMonth = monthlyTrend(prodano);
  const topDeals = [...prodano].sort((a, b) => (marze(b) ?? 0) - (marze(a) ?? 0)).slice(0, 5);
  const worstDeals = [...prodano]
    .filter((v) => (marze(v) ?? 0) < 0)
    .sort((a, b) => (marze(a) ?? 0) - (marze(b) ?? 0))
    .slice(0, 5);

  const empName = (id: string | null) => employees?.find((e) => e.id === id)?.name ?? "—";
  const pricerStats = pricerLeaderboard(prodano, empName);

  return (
    <AdminShell requireModule="vykupy">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Divize Ojeté Vozy
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <BarChart3 className="h-7 w-7 text-orange-500" />
              Dashboard výkupů
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/vykupy">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Zpět na seznam
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 inline-flex rounded-lg border bg-card p-1 text-sm">
          {(["30d", "90d", "ytd", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition",
                period === p
                  ? "bg-orange-500 text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p === "30d" ? "30 dní" : p === "90d" ? "90 dní" : p === "ytd" ? "Tento rok" : "Vše"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Načítám…</p>
        ) : (
          <>
            {/* KPI */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Prodáno aut"
                value={prodano.length}
                icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                tint="bg-emerald-100"
              />
              <Stat
                label="Obrat"
                value={formatKc(obrat)}
                icon={<Coins className="h-5 w-5 text-primary" />}
                tint="bg-primary/10"
              />
              <Stat
                label="Marže celkem"
                value={formatKc(marzeTotal)}
                sub={`${marzePct.toFixed(1)} %`}
                icon={<Award className="h-5 w-5 text-amber-600" />}
                tint="bg-amber-100"
              />
              <Stat
                label="Ø marže / auto"
                value={formatKc(Math.round(avgMarze))}
                icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}
                tint="bg-emerald-100"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="V nacenění"
                value={naceneni.length}
                icon={<Clock className="h-5 w-5 text-amber-600" />}
                tint="bg-amber-100"
              />
              <Stat
                label="Skladem (vykoupeno)"
                value={vykoupeno.length}
                icon={<Car className="h-5 w-5 text-blue-600" />}
                tint="bg-blue-100"
              />
              <Stat
                label="Vázaný kapitál"
                value={formatKc(vazanyKapital)}
                icon={<Coins className="h-5 w-5 text-blue-600" />}
                tint="bg-blue-100"
              />
              <Stat
                label="Zamítnuto"
                value={zamitnuto.length}
                icon={<TrendingDown className="h-5 w-5 text-rose-600" />}
                tint="bg-rose-100"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Měsíční trend (prodáno)">
                <MonthlyBars data={byMonth} />
              </Panel>
              <Panel title="Podle značky (prodáno)">
                <BarList
                  items={byZnacka.map((g) => ({
                    label: g.key,
                    value: g.items.length,
                    secondary: formatKc(sum(g.items.map((v) => marze(v) ?? 0))),
                  }))}
                />
              </Panel>
              <Panel title="Podle zdroje">
                <BarList items={byZdroj.map((g) => ({ label: g.key, value: g.items.length }))} />
              </Panel>
              <Panel title="Výtěžnost podle cenaře (interní)">
                {pricerStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Žádný prodaný výkup zatím nemá interní nacenění.
                  </p>
                ) : (
                  <div className="divide-y">
                    {pricerStats.map((r) => (
                      <div key={r.name} className="flex items-center justify-between py-2 text-sm">
                        <span className="font-medium">{r.name}</span>
                        <span className="flex gap-4 tabular-nums text-muted-foreground">
                          <span>{r.deals} obch.</span>
                          <span
                            className={cn(
                              "font-semibold",
                              r.marze >= 0 ? "text-emerald-600" : "text-rose-600",
                            )}
                          >
                            {formatKc(r.marze)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="TOP 5 obchodů">
                <DealList rows={topDeals} positive />
              </Panel>
              <Panel title="Ztrátové obchody">
                {worstDeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Žádný ztrátový obchod – výborně.</p>
                ) : (
                  <DealList rows={worstDeals} />
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  tint,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 truncate text-xl font-bold md:text-2xl">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tint)}>
        {icon}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function BarList({ items }: { items: { label: string; value: number; secondary?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Žádná data.</p>;
  return (
    <div className="space-y-2">
      {items
        .sort((a, b) => b.value - a.value)
        .map((i) => (
          <div key={i.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{i.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {i.value}
                {i.secondary ? ` · ${i.secondary}` : ""}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-orange-500"
                style={{ width: `${(i.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
    </div>
  );
}

function MonthlyBars({ data }: { data: { key: string; count: number; marze: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Žádná data.</p>;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((d) => (
        <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
          <div className="text-[10px] tabular-nums text-muted-foreground">{d.count}</div>
          <div
            className="w-full rounded-t bg-orange-500"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
            title={`${d.key}: ${d.count} ks, marže ${formatKc(d.marze)}`}
          />
          <div className="text-[10px] text-muted-foreground">{d.key}</div>
        </div>
      ))}
    </div>
  );
}

function DealList({ rows, positive }: { rows: Vykup[]; positive?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Žádná data.</p>;
  return (
    <div className="divide-y">
      {rows.map((v) => {
        const m = marze(v) ?? 0;
        return (
          <Link
            key={v.id}
            to="/vykupy/$id"
            params={{ id: v.id }}
            className="flex items-center justify-between py-2 text-sm hover:bg-muted/40"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">
                {v.znacka} {v.model}
              </div>
              <div className="text-xs text-muted-foreground">
                {v.klient} · {formatDate(v.datum_vykupu)}
              </div>
            </div>
            <div
              className={cn(
                "tabular-nums font-semibold",
                positive ? "text-emerald-600" : m < 0 ? "text-rose-600" : "text-emerald-600",
              )}
            >
              {formatKc(m)}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// --- helpers ---
function sum(a: number[]) {
  return a.reduce((s, n) => s + (n || 0), 0);
}

function filterByPeriod(rows: Vykup[], period: Period): Vykup[] {
  if (period === "all") return rows;
  const now = new Date();
  let from: Date;
  if (period === "30d") from = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  else if (period === "90d") from = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  else from = new Date(now.getFullYear(), 0, 1);
  return rows.filter((v) => {
    const d = new Date(v.datum_vykupu ?? v.created_at);
    return d >= from;
  });
}

function groupBy<T>(rows: T[], key: (r: T) => string): { key: string; items: T[] }[] {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k) ?? [];
    arr.push(r);
    m.set(k, arr);
  }
  return [...m.entries()].map(([k, items]) => ({ key: k, items }));
}

function monthlyTrend(rows: Vykup[]): { key: string; count: number; marze: number }[] {
  const buckets = new Map<string, { count: number; marze: number }>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
    buckets.set(k, { count: 0, marze: 0 });
  }
  for (const v of rows) {
    const d = new Date(v.datum_vykupu ?? v.created_at);
    const k = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
    if (!buckets.has(k)) continue;
    const b = buckets.get(k)!;
    b.count += 1;
    b.marze += marze(v) ?? 0;
  }
  return [...buckets.entries()].map(([key, b]) => ({ key, ...b }));
}

function pricerLeaderboard(rows: Vykup[], name: (id: string | null) => string) {
  const m = new Map<string, { name: string; deals: number; marze: number }>();
  for (const v of rows) {
    const uid = v.internal_priced_by_user_id;
    if (!uid) continue;
    const cur = m.get(uid) ?? { name: name(uid), deals: 0, marze: 0 };
    cur.deals += 1;
    cur.marze += marze(v) ?? 0;
    m.set(uid, cur);
  }
  return [...m.values()].sort((a, b) => b.marze - a.marze);
}
