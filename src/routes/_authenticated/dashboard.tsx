import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { AdminShell } from "@/components/AdminShell";
import { listClaims, getMyAccess } from "@/lib/claims.functions";
import { listVykupy, formatKc, marze } from "@/lib/vykupy";
import { listEmployees } from "@/lib/claims.functions";
import { listDefects } from "@/lib/defects.functions";
import {
  listEmployees as listDochazkaEmployees,
  listRecords as listDochazkaRecords,
  listAbsences as listDochazkaAbsences,
} from "@/lib/dochazka.functions";
import {
  FolderOpen, AlertCircle, AlertTriangle, LogIn, Timer,
  PalmtreeIcon, Trophy, Wrench, FileWarning, ArrowRight,
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
  const fetchDefects = useServerFn(listDefects);
  const today = new Date().toISOString().slice(0, 10);
  const monthFrom = today.slice(0, 7) + "-01";
  const yearFrom = today.slice(0, 4) + "-01-01";
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
  const { data: dochYearRecs } = useQuery({
    queryKey: ["dash", "doch", "year", yearFrom],
    queryFn: () => fetchDochRec({ data: { from: yearFrom } }),
    enabled: isAdmin,
  });
  const { data: defects } = useQuery({
    queryKey: ["dash", "defects"],
    queryFn: () => fetchDefects({}),
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

  const dppWarnings = useMemo(() => {
    if (!dochEmps || !dochYearRecs) return [] as { id: string; name: string; hours: number; over: boolean }[];
    const dpp = (dochEmps as any[]).filter((e) => e.employment_type === "dpp" && e.active);
    const map = new Map<string, number>();
    for (const r of dochYearRecs as any[]) {
      map.set(r.employee_id, (map.get(r.employee_id) ?? 0) + Number(r.hours_worked ?? 0));
    }
    return dpp
      .map((e) => ({ id: e.id, name: e.name, hours: map.get(e.id) ?? 0 }))
      .filter((x) => x.hours >= 270)
      .map((x) => ({ ...x, over: x.hours >= 300 }))
      .sort((a, b) => b.hours - a.hours);
  }, [dochEmps, dochYearRecs]);

  const defectStats = useMemo(() => {
    const rows = (defects?.rows ?? []) as any[];
    return {
      open: rows.filter((d) => d.status === "new" || d.status === "in_progress").length,
      critical: rows.filter((d) => d.priority === "critical" && d.status !== "closed" && d.status !== "resolved").length,
      resolved: rows.filter((d) => d.status === "resolved" || d.status === "closed").length,
    };
  }, [defects]);

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
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Vedení společnosti
            </p>
            <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
              Přehled všech modulů
            </h1>
          </div>
          <div className="hidden text-sm font-medium text-slate-500 sm:flex sm:items-center sm:gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Aktualizováno: Právě teď
          </div>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Pojistné události */}
          <div className="flex flex-col space-y-4 md:col-span-4">
            <SectionHeader stripe="bg-blue-600" title="Pojistné události" to="/admin" />
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-500">Aktivní zakázky</p>
                  <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
                    {activeClaims}
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                  <FolderOpen className="h-6 w-6" />
                </div>
              </div>

              <Link
                to="/admin"
                className={cn(
                  "block rounded-xl border p-4 transition-colors",
                  unpaidVat > 0
                    ? "border-red-100 bg-red-50 hover:bg-red-100/60"
                    : "border-emerald-100 bg-emerald-50 hover:bg-emerald-100/60",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-xs font-bold uppercase tracking-wide",
                        unpaidVat > 0 ? "text-red-700" : "text-emerald-700",
                      )}
                    >
                      Neuhrazené DPH
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-bold tabular-nums",
                        unpaidVat > 0 ? "text-red-800" : "text-emerald-800",
                      )}
                    >
                      {unpaidVat}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      unpaidVat > 0
                        ? "animate-pulse bg-red-100 text-red-600"
                        : "bg-emerald-100 text-emerald-600",
                    )}
                  >
                    <AlertCircle className="h-5 w-5" />
                  </div>
                </div>
              </Link>

              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-xs text-slate-500">Celkový počet zakázek</span>
                <span className="text-xs font-bold tabular-nums text-slate-700">
                  {totalClaims}
                </span>
              </div>
            </div>
          </div>

          {/* Ojeté vozy */}
          <div className="flex flex-col space-y-4 md:col-span-8">
            <SectionHeader stripe="bg-emerald-500" title="Ojeté vozy" to="/vykupy" />

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <MiniStat label="Aktivní výkupy" value={aktivniVykupy} />
              <MiniStat label="Prodáno celkem" value={prodano.length} />
              <MiniStat label="Obrat" value={formatKc(obrat)} />
              <MiniStat
                label="Marže"
                value={formatKc(totalMarze)}
                valueClassName={totalMarze >= 0 ? "text-emerald-600" : "text-rose-600"}
              />
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="pointer-events-none absolute right-2 top-2 opacity-5">
                <Trophy className="h-20 w-20" />
              </div>
              <h3 className="mb-4 text-sm font-bold text-slate-700">
                Výtěžnost podle cenaře (interní nacenění)
              </h3>
              <PricerLeaderboard rows={prodano} employees={employees ?? []} />
            </div>
          </div>

          {/* Docházka */}
          <div className="flex flex-col space-y-4 md:col-span-8">
            <SectionHeader
              stripe="bg-amber-500"
              title="Docházka & personálie"
              to="/dochazka"
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Odpracováno tento měsíc
                    </p>
                    <p className="text-4xl font-black tabular-nums text-slate-900">
                      {dochStats.totalHours.toFixed(1)}
                      <span className="ml-1 text-lg font-medium text-slate-400">h</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="mb-1 text-[11px] font-bold uppercase text-amber-600">
                      DPP limit (300 h/rok)
                    </p>
                    <p className="text-xs text-slate-500">
                      {dppWarnings.length === 0
                        ? "Bez upozornění"
                        : `${dppWarnings.length} ${dppWarnings.length === 1 ? "zaměstnanec" : "zaměstnanců"} blízko limitu`}
                    </p>
                  </div>
                </div>

                {dppWarnings.length > 0 && (
                  <div className="mb-6 space-y-2">
                    {dppWarnings.map((w) => {
                      const pct = Math.min(100, (w.hours / 300) * 100);
                      return (
                        <div key={w.id}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-700">{w.name}</span>
                            <span
                              className={cn(
                                "font-mono text-xs font-semibold tabular-nums",
                                w.over ? "text-rose-700" : "text-amber-700",
                              )}
                            >
                              {w.hours.toFixed(1)} / 300 h{w.over ? " · překročeno" : ""}
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                w.over ? "bg-rose-500" : "bg-amber-400",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                  <Trophy className="h-3 w-3" /> Top 5 hodin · tento měsíc
                </h4>
                {dochStats.top.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-400">
                    Zatím žádné záznamy.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dochStats.top.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                            {initials(r.name)}
                          </div>
                          <span className="truncate text-sm font-semibold text-slate-700">
                            {r.name}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                          {r.hours.toFixed(1)} h
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <SideStat
                  label="V práci"
                  value={dochStats.inWork}
                  icon={<LogIn className="h-6 w-6" />}
                  tint="bg-emerald-50 text-emerald-600"
                />
                <SideStat
                  label="Čekající absence"
                  value={dochStats.pendingAbs}
                  icon={<PalmtreeIcon className="h-6 w-6" />}
                  tint="bg-amber-50 text-amber-600"
                />
                <SideStat
                  label="Aktivní zaměstnanci"
                  value={dochStats.activeEmps}
                  icon={<Timer className="h-6 w-6" />}
                  tint="bg-blue-50 text-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Závady */}
          <div className="flex flex-col space-y-4 md:col-span-4">
            <SectionHeader stripe="bg-red-600" title="Závady" to="/zavady" />

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Otevřené</p>
                  <p className="text-xl font-bold tabular-nums text-slate-800">
                    {defectStats.open}
                  </p>
                </div>
                <div className="flex-1 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">Vyřešené</p>
                  <p className="text-xl font-bold tabular-nums text-emerald-800">
                    {defectStats.resolved}
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "relative flex items-center justify-between overflow-hidden rounded-xl p-4 text-white",
                  defectStats.critical > 0 ? "bg-rose-700" : "bg-slate-900",
                )}
              >
                <div className="relative z-10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                    Kritické závady
                  </p>
                  <p className="text-3xl font-black tabular-nums">{defectStats.critical}</p>
                </div>
                <FileWarning
                  className={cn(
                    "absolute -bottom-2 -right-2 h-16 w-16",
                    defectStats.critical > 0 ? "text-white opacity-20" : "text-rose-500 opacity-20",
                  )}
                />
              </div>
              <p className="text-center text-[10px] font-medium italic text-slate-400">
                {defectStats.critical > 0
                  ? "Vyžadují okamžitou pozornost."
                  : "Aktuálně nejsou hlášeny žádné kritické závady."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function SectionHeader({
  stripe,
  title,
  to,
}: {
  stripe: string;
  title: string;
  to: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
        <span className={cn("h-6 w-1.5 rounded-full", stripe)} />
        {title}
      </h2>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
      >
        Otevřít modul <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function MiniStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number | string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums text-slate-900", valueClassName)}>
        {value}
      </p>
    </div>
  );
}

function SideStat({
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
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      </div>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tint)}>
        {icon}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
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
    return (
      <div className="flex flex-col items-center justify-center py-6 text-slate-400">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
          <Trophy className="h-6 w-6 text-slate-300" />
        </div>
        <p className="text-sm">Žádný prodaný výkup zatím nemá interní nacenění.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-slate-100">
      {list.map((r) => (
        <div key={r.name} className="flex items-center justify-between py-2.5 text-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              {initials(r.name)}
            </div>
            <span className="truncate font-semibold text-slate-700">{r.name}</span>
          </div>
          <span className="flex shrink-0 items-center gap-4 tabular-nums text-slate-500">
            <span>{r.deals} obchodů</span>
            <span className="hidden sm:inline">obrat {formatKc(r.obrat)}</span>
            <span className={cn("font-semibold", r.marze >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {formatKc(r.marze)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}