import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { getStorageSavings } from "@/lib/storage-stats.functions";
import { ArrowLeft, HardDrive, ImageIcon, TrendingDown, Database } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/storage")({
  component: StorageStatsPage,
  head: () => ({ meta: [{ title: "Úspora úložiště – Autoport" }] }),
});

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const BUCKET_LABELS: Record<string, string> = {
  "defect-photos": "Závady",
  "vykup-photos": "Ojeté vozy",
  "logbook-receipts": "Kniha jízd – účtenky",
  "task-attachments": "Úkoly – přílohy",
  "claim-files": "Zakázky – soubory",
  "client-documents": "Zápůjčky – dokumenty",
};

function StorageStatsPage() {
  const fetch = useServerFn(getStorageSavings);
  const { data, isLoading, error } = useQuery({
    queryKey: ["storage-savings"],
    queryFn: () => fetch(),
    staleTime: 60_000,
  });

  // ratio = current / original (např. 0.2 = ušetřeno 80 %)
  const [ratio, setRatio] = useState(0.2);

  const stats = useMemo(() => {
    const rows = data?.rows ?? [];
    const images = rows.filter((r) => r.is_image);
    const currentTotal = images.reduce((s, r) => s + r.size, 0);
    const originalTotal = ratio > 0 ? currentTotal / ratio : currentTotal;
    const saved = originalTotal - currentTotal;

    const byBucket = new Map<string, { count: number; size: number }>();
    for (const r of images) {
      const cur = byBucket.get(r.bucket) ?? { count: 0, size: 0 };
      cur.count += 1;
      cur.size += r.size;
      byBucket.set(r.bucket, cur);
    }

    // monthly buckets last 12 months
    const now = new Date();
    const months: { key: string; label: string; size: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
      months.push({ key, label, size: 0, count: 0 });
    }
    const idx = new Map(months.map((m, i) => [m.key, i] as const));
    for (const r of images) {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const i = idx.get(key);
      if (i !== undefined) {
        months[i].size += r.size;
        months[i].count += 1;
      }
    }
    // cumulative
    let acc = 0;
    const cumulative = months.map((m) => {
      acc += m.size;
      return { ...m, cumulative: acc };
    });

    return {
      totalImages: images.length,
      currentTotal,
      originalTotal,
      saved,
      byBucket: [...byBucket.entries()]
        .map(([bucket, v]) => ({ bucket, ...v }))
        .sort((a, b) => b.size - a.size),
      months: cumulative,
    };
  }, [data, ratio]);

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Administrace
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <HardDrive className="h-7 w-7 text-primary" />
              Úspora úložiště
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kolik místa jsi ušetřil díky automatickému zmenšování fotografií (max 1920 px, JPEG ~85 %).
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin"><ArrowLeft className="mr-1 h-4 w-4" />Zpět</Link>
          </Button>
        </div>

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Načítám statistiky úložiště…</p>
        ) : error ? (
          <p className="mt-10 text-sm text-rose-600">Nepodařilo se načíst statistiky: {(error as Error).message}</p>
        ) : (
          <>
            {/* Ratio slider */}
            <div className="mt-6 rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Odhadovaný poměr komprese</p>
                  <p className="text-xs text-muted-foreground">
                    Poměr velikosti po zmenšení vůči originálu. Výchozí 20 % (ušetřeno ~80 %) odpovídá běžným fotkám z mobilu.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Ušetřeno</span>
                  <span className="text-lg font-bold tabular-nums text-emerald-600">
                    {Math.round((1 - ratio) * 100)} %
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={ratio}
                onChange={(e) => setRatio(Number(e.target.value))}
                className="mt-3 w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>90 % úspora</span>
                <span>50 %</span>
                <span>10 % úspora</span>
              </div>
            </div>

            {/* KPI */}
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Aplikace celkem"
                value={formatBytes(data?.totals?.size ?? 0)}
                sub={`${(data?.totals?.count ?? 0).toLocaleString("cs-CZ")} souborů ve všech bucketech`}
                icon={<HardDrive className="h-5 w-5 text-slate-700" />}
                tint="bg-slate-100"
              />
              <Stat
                label="Fotografií celkem"
                value={stats.totalImages.toLocaleString("cs-CZ")}
                icon={<ImageIcon className="h-5 w-5 text-primary" />}
                tint="bg-primary/10"
              />
              <Stat
                label="Aktuálně zabírají"
                value={formatBytes(stats.currentTotal)}
                icon={<Database className="h-5 w-5 text-blue-600" />}
                tint="bg-blue-100"
              />
              <Stat
                label="Ušetřeno"
                value={formatBytes(stats.saved)}
                sub={`${Math.round((1 - ratio) * 100)} % · bez zmenšení by fotky zabíraly ${formatBytes(stats.originalTotal)}`}
                icon={<TrendingDown className="h-5 w-5 text-emerald-600" />}
                tint="bg-emerald-100"
                highlight
              />
            </div>

            {data?.totals && data.totals.byBucket.length > 0 && (
              <div className="mt-4 rounded-xl border bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Celkové využití úložiště (všechny buckety)
                </h3>
                <div className="space-y-2">
                  {data.totals.byBucket
                    .slice()
                    .sort((a, b) => b.size - a.size)
                    .map((b) => {
                      const max = Math.max(1, ...data.totals!.byBucket.map((x) => x.size));
                      return (
                        <div key={b.bucket}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{BUCKET_LABELS[b.bucket] ?? b.bucket}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {b.count.toLocaleString("cs-CZ")} ks · {formatBytes(b.size)}
                            </span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-slate-500"
                              style={{ width: `${(b.size / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Úspora podle měsíce (posledních 12)">
                <MonthlyChart data={stats.months} ratio={ratio} />
              </Panel>
              <Panel title="Kumulativní úspora">
                <CumulativeChart data={stats.months} ratio={ratio} />
              </Panel>
            </div>

            <div className="mt-6 rounded-xl border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Podle modulu
              </h3>
              {stats.byBucket.length === 0 ? (
                <p className="text-sm text-muted-foreground">Zatím žádné fotografie.</p>
              ) : (
                <div className="space-y-3">
                  {stats.byBucket.map((b) => {
                    const original = ratio > 0 ? b.size / ratio : b.size;
                    const saved = original - b.size;
                    const max = Math.max(
                      1,
                      ...stats.byBucket.map((x) => (ratio > 0 ? x.size / ratio : x.size)),
                    );
                    return (
                      <div key={b.bucket}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{BUCKET_LABELS[b.bucket] ?? b.bucket}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {b.count.toLocaleString("cs-CZ")} ks · {formatBytes(b.size)}
                            <span className="ml-2 font-semibold text-emerald-600">
                              −{formatBytes(saved)}
                            </span>
                          </span>
                        </div>
                        <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${(b.size / max) * 100}%` }}
                            title={`Aktuální: ${formatBytes(b.size)}`}
                          />
                          <div
                            className="h-full bg-emerald-500/70"
                            style={{ width: `${(saved / max) * 100}%` }}
                            title={`Ušetřeno: ${formatBytes(saved)}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> Aktuálně zabírá
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/70" /> Ušetřeno
                    </span>
                  </div>
                </div>
              )}
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
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border bg-card p-4",
        highlight && "border-emerald-300 bg-emerald-50/50",
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 truncate text-xl font-bold md:text-2xl",
            highlight && "text-emerald-700",
          )}
        >
          {value}
        </p>
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

function MonthlyChart({
  data,
  ratio,
}: {
  data: { label: string; size: number; count: number }[];
  ratio: number;
}) {
  const bars = data.map((d) => {
    const original = ratio > 0 ? d.size / ratio : d.size;
    const saved = original - d.size;
    return { ...d, original, saved };
  });
  const max = Math.max(1, ...bars.map((b) => b.original));
  if (bars.every((b) => b.size === 0)) {
    return <p className="text-sm text-muted-foreground">Žádné fotografie v posledních 12 měsících.</p>;
  }
  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {bars.map((b) => (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
            <div className="text-[10px] tabular-nums text-emerald-600">
              {b.saved > 0 ? formatBytesShort(b.saved) : ""}
            </div>
            <div
              className="relative w-full overflow-hidden rounded-t bg-muted"
              style={{ height: `${(b.original / max) * 100}%`, minHeight: b.original > 0 ? 6 : 0 }}
              title={`${b.label}: ${b.count} ks · aktuální ${formatBytes(b.size)} · úspora ${formatBytes(b.saved)}`}
            >
              <div
                className="absolute inset-x-0 top-0 bg-emerald-500/70"
                style={{ height: `${(b.saved / (b.original || 1)) * 100}%` }}
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-primary"
                style={{ height: `${(b.size / (b.original || 1)) * 100}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">{b.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> Aktuálně
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/70" /> Ušetřeno
        </span>
      </div>
    </div>
  );
}

function CumulativeChart({
  data,
  ratio,
}: {
  data: { label: string; cumulative: number }[];
  ratio: number;
}) {
  const points = data.map((d) => {
    const original = ratio > 0 ? d.cumulative / ratio : d.cumulative;
    return { label: d.label, current: d.cumulative, original, saved: original - d.cumulative };
  });
  const max = Math.max(1, ...points.map((p) => p.original));
  const w = 100;
  const h = 100;
  const step = points.length > 1 ? w / (points.length - 1) : w;

  const pathOriginal = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${(h - (p.original / max) * h).toFixed(2)}`)
    .join(" ");
  const pathCurrent = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${(h - (p.current / max) * h).toFixed(2)}`)
    .join(" ");
  const areaSaved =
    pathOriginal +
    " " +
    points
      .slice()
      .reverse()
      .map((p, i) => {
        const idx = points.length - 1 - i;
        return `L ${(idx * step).toFixed(2)} ${(h - (p.current / max) * h).toFixed(2)}`;
      })
      .join(" ") +
    " Z";

  const last = points[points.length - 1];

  if (max <= 1) {
    return <p className="text-sm text-muted-foreground">Zatím není co zobrazit.</p>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-40 w-full">
        <path d={areaSaved} fill="rgb(16 185 129 / 0.25)" />
        <path d={pathOriginal} fill="none" stroke="rgb(245 158 11)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d={pathCurrent} fill="none" stroke="rgb(59 130 246)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
        <div className="text-muted-foreground">
          <span className="mr-3">
            <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-amber-500" />
            Bez zmenšení
          </span>
          <span className="mr-3">
            <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-blue-500" />
            Aktuálně
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-emerald-500/40" />
            Úspora
          </span>
        </div>
        <div className="tabular-nums">
          <span className="text-muted-foreground">Celkem ušetřeno: </span>
          <span className="font-semibold text-emerald-600">{formatBytes(last.saved)}</span>
        </div>
      </div>
    </div>
  );
}

function formatBytesShort(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}k`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}M`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)}G`;
}