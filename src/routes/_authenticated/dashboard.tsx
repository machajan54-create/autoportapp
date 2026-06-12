import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { AdminShell } from "@/components/AdminShell";
import { listClaims, getMyAccess } from "@/lib/claims.functions";
import { listVykupy, formatKc, marze } from "@/lib/vykupy";
import { listEmployees } from "@/lib/claims.functions";
import {
  listEmployees as listDochazkaEmployees,
  listRecords as listDochazkaRecords,
  listAbsences as listDochazkaAbsences,
} from "@/lib/dochazka.functions";
import {
  FolderOpen, AlertCircle, Car, Coins, TrendingUp, Users,
  Clock, LogIn, PalmtreeIcon, Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const fetchAccess = useServerFn(getMyAccess);
  const fetchClaims = useServerFn(listClaims);
  const fetchEmployees = useServerFn(listEmployees);
  const { data: access, isLoading: aLoad } = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess({}),
  });

  const isAdmin = !!access?.isAdmin;

  const { data: claims } = useQuery({
    queryKey: ["claims"],
    queryFn: () => fetchClaims({}),
    enabled: isAdmin,
  });
  const { data: vykupy } = useQuery({
    queryKey: ["vykupy"],
    queryFn: () => listVykupy(),
    enabled: isAdmin,
  });
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => fetchEmployees({}),
    enabled: isAdmin,
  });

  // Docházka
  const fetchDochEmp = useServerFn(listDochazkaEmployees);
  const fetchDochRec = useServerFn(listDochazkaRecords);
  const fetchDochAbs = useServerFn(listDochazkaAbsences);
  const today = new Date().toISOString().slice(0, 10);
  const monthFrom = today.slice(0, 7) + "-01";
  const { data: dochEmps } = useQuery({
    queryKey: ["dash", "doch", "emps"],
    queryFn: () => fetchDochEmp({}),
    enabled: isAdmin,
  });
  const { data: dochRecs } = useQuery({
    queryKey: ["dash", "doch", "recs", monthFrom],
    queryFn: () => fetchDochRec({ data: { from: monthFrom } }),
    enabled: isAdmin,
  });
  const { data: dochAbs } = useQuery({
    queryKey: ["dash", "doch", "abs"],
    queryFn: () => fetchDochAbs({}),
    enabled: isAdmin,
  });

  const dochStats = useMemo(() => {
    const recs = dochRecs ?? [];
    const todayRecs = recs.filter((r: any) => r.date === today);
    const inWork = todayRecs.filter((r: any) => !r.check_out).length;
    const totalHours = recs.reduce((s: number, r: any) => s + Number(r.hours_worked ?? 0), 0);
    const pendingAbs = (dochAbs ?? []).filter((a: any) => a.status === "pending").length;
    const activeEmps = (dochEmps ?? []).filter((e: any) => e.active).length;
    // Top 5 by hours (month)
    const byEmp = new Map<string, number>();
    recs.forEach((r: any) => {
      byEmp.set(r.employee_id, (byEmp.get(r.employee_id) ?? 0) + Number(r.hours_worked ?? 0));
    });
    const top = Array.from(byEmp.entries())
      .map(([id, hours]) => ({
        id,
        name: (dochEmps ?? []).find((e: any) => e.id === id)?.name ?? "Neznámý",
        hours,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
    return { inWork, totalHours, pendingAbs, activeEmps, top };
  }, [dochRecs, dochAbs, dochEmps, today]);

  if (aLoad) {
    return (
      <AdminShell>
        <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Načítám…</div>
      </AdminShell>
    );
  }

  if (!isAdmin) {
    return (
      <AdminShell>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h2 className="text-lg font-semibold">Pouze pro majitele / ředitele</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tento dashboard je dostupný jen super adminům.
          </p>
        </div>
      </AdminShell>
    );
  }

  const activeClaims = (claims ?? []).filter((c) => c.status !== "done" && c.status !== "closed").length;
  const unpaidVat = (claims ?? []).filter((c) => !c.vat_paid && c.status !== "done" && c.status !== "closed").length;
  const totalClaims = claims?.length ?? 0;

  const vyk = vykupy ?? [];
  const aktivniVykupy = vyk.filter((v) => v.stav !== "Prodáno" && v.stav !== "Zamítnuto").length;
  const prodano = vyk.filter((v) => v.stav === "Prodáno");
  const totalMarze = prodano.reduce((s, v) => s + (marze(v) ?? 0), 0);
  const obrat = prodano.reduce((s, v) => s + (v.prodano_za ?? 0), 0);

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Vedení společnosti
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Přehled všech modulů</h1>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pojistné události
            </h2>
            <Link to="/admin" className="text-sm text-primary hover:underline">
              Otevřít modul →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Aktivní zakázky" value={activeClaims} icon={<FolderOpen className="h-5 w-5 text-primary" />} tint="bg-primary/10" />
            <Stat label="Neuhrazené DPH" value={unpaidVat} icon={<AlertCircle className="h-5 w-5 text-rose-600" />} tint="bg-rose-100" />
            <Stat label="Celkem zakázek" value={totalClaims} icon={<Users className="h-5 w-5 text-emerald-600" />} tint="bg-emerald-100" />
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Ojeté vozy
            </h2>
            <Link to="/vykupy" className="text-sm text-primary hover:underline">
              Otevřít modul →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Aktivní výkupy" value={aktivniVykupy} icon={<Car className="h-5 w-5 text-orange-600" />} tint="bg-orange-100" />
            <Stat label="Prodáno celkem" value={prodano.length} icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} tint="bg-emerald-100" />
            <Stat label="Obrat (prodáno)" value={formatKc(obrat)} icon={<Coins className="h-5 w-5 text-primary" />} tint="bg-primary/10" />
            <Stat label="Marže celkem" value={formatKc(totalMarze)} icon={<Coins className="h-5 w-5 text-emerald-600" />} tint="bg-emerald-100" />
          </div>

          <div className="mt-6 rounded-xl border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Výtěžnost podle cenaře (interní nacenění)
            </h3>
            <PricerLeaderboard rows={prodano} employees={employees ?? []} />
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Docházka
            </h2>
            <Link to="/dochazka" className="text-sm text-primary hover:underline">
              Otevřít modul →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Aktuálně v práci" value={dochStats.inWork} icon={<LogIn className="h-5 w-5 text-emerald-600" />} tint="bg-emerald-100" />
            <Stat label="Odpracováno (měsíc)" value={`${dochStats.totalHours.toFixed(1)} h`} icon={<Timer className="h-5 w-5 text-sky-600" />} tint="bg-sky-100" />
            <Stat label="Čekající absence" value={dochStats.pendingAbs} icon={<PalmtreeIcon className="h-5 w-5 text-amber-600" />} tint="bg-amber-100" />
            <Stat label="Aktivní zaměstnanci" value={dochStats.activeEmps} icon={<Clock className="h-5 w-5 text-primary" />} tint="bg-primary/10" />
          </div>

          <div className="mt-6 rounded-xl border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Top 5 — odpracované hodiny tento měsíc
            </h3>
            {dochStats.top.length === 0 ? (
              <p className="text-sm text-muted-foreground">Zatím žádné záznamy.</p>
            ) : (
              <div className="divide-y">
                {dochStats.top.map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="flex items-center gap-3">
                      <span className="w-5 text-right text-xs text-muted-foreground">{i + 1}.</span>
                      <span className="font-medium">{r.name}</span>
                    </span>
                    <span className="font-mono font-semibold tabular-nums">{r.hours.toFixed(1)} h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold md:text-3xl">{value}</p>
      </div>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tint)}>{icon}</div>
    </div>
  );
}

function PricerLeaderboard({
  rows,
  employees,
}: {
  rows: ReturnType<typeof Object>[] | any[];
  employees: { id: string; name: string }[];
}) {
  const byUser = new Map<string, { name: string; deals: number; marze: number; obrat: number }>();
  for (const v of rows) {
    const uid: string | null = v.internal_priced_by_user_id ?? null;
    if (!uid) continue;
    const name = employees.find((e) => e.id === uid)?.name ?? "Neznámý";
    const m = marze(v) ?? 0;
    const cur = byUser.get(uid) ?? { name, deals: 0, marze: 0, obrat: 0 };
    cur.deals += 1;
    cur.marze += m;
    cur.obrat += v.prodano_za ?? 0;
    byUser.set(uid, cur);
  }
  const list = [...byUser.values()].sort((a, b) => b.marze - a.marze);
  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">Žádný prodaný výkup zatím nemá interní nacenění.</p>;
  }
  return (
    <div className="divide-y">
      {list.map((r) => (
        <div key={r.name} className="flex items-center justify-between py-2 text-sm">
          <span className="font-medium">{r.name}</span>
          <span className="flex gap-4 tabular-nums text-muted-foreground">
            <span>{r.deals} obchodů</span>
            <span>obrat {formatKc(r.obrat)}</span>
            <span className={cn("font-semibold", r.marze >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {formatKc(r.marze)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}