import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { listClaims, getMyAccess } from "@/lib/claims.functions";
import { listVykupy, formatKc, marze } from "@/lib/vykupy";
import { FolderOpen, AlertCircle, Car, Coins, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const fetchAccess = useServerFn(getMyAccess);
  const fetchClaims = useServerFn(listClaims);
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