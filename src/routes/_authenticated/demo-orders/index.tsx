import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";

import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, ClipboardSignature } from "lucide-react";
import { RequestDeleteButton } from "@/components/RequestDeleteButton";
import { listDemoOrders } from "@/lib/demo-orders.functions";
import { getMyAccess } from "@/lib/claims.functions";
import { cn } from "@/lib/utils";

const demoOrdersListOptions = queryOptions({
  queryKey: ["demo-orders"],
  queryFn: () => listDemoOrders({}),
});
const demoAccessOptions = queryOptions({
  queryKey: ["my-access"],
  queryFn: () => getMyAccess({}),
});

export const Route = createFileRoute("/_authenticated/demo-orders/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(demoOrdersListOptions),
      context.queryClient.ensureQueryData(demoAccessOptions),
    ]),
  pendingComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Načítám objednávky…</div>
  ),
  errorComponent: ({ error }: { error: Error }) => (
    <div role="alert" className="p-8 text-red-600">
      {error instanceof Error ? error.message : "Načítání selhalo"}
    </div>
  ),
  component: DemoOrdersList,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Koncept",
  sent_for_signature: "Čeká na podpis",
  signed: "Podepsáno",
  cancelled: "Zrušeno",
};
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent_for_signature: "bg-amber-100 text-amber-900 border-amber-300",
  signed: "bg-emerald-100 text-emerald-900 border-emerald-300",
  cancelled: "bg-rose-100 text-rose-900 border-rose-300",
};

function fmtKc(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function DemoOrdersList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: access } = useSuspenseQuery(demoAccessOptions);
  const isAdmin = !!access?.isAdmin;
  const { data } = useSuspenseQuery(demoOrdersListOptions);
  const [q, setQ] = useState("");

  const rows = (data?.rows ?? []).filter((r: any) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      (r.order_number || "").toLowerCase().includes(t) ||
      (r.model_verze || "").toLowerCase().includes(t) ||
      (r.rz || "").toLowerCase().includes(t) ||
      (r.vin || "").toLowerCase().includes(t) ||
      (r.client?.full_name || "").toLowerCase().includes(t) ||
      (r.client?.company || "").toLowerCase().includes(t)
    );
  });

  return (
    <AdminShell requireModule="demo_orders">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Divize Nové vozy
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <ClipboardSignature className="h-7 w-7 text-primary" />
            Objednávky předváděcích vozů
          </h1>
          <Button onClick={() => navigate({ to: "/demo-orders/$id", params: { id: "novy" } })}>
            <Plus className="mr-1 h-4 w-4" />
            Nová objednávka
          </Button>
        </div>

        <div className="mt-6 rounded-xl border bg-card p-3">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat číslo, klient, model…"
              className="h-9 pl-8"
            />
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Číslo</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>RZ / VIN</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Cena s DPH</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    Žádné objednávky.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r: any) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => navigate({ to: "/demo-orders/$id", params: { id: r.id } })}
                >
                  <TableCell className="font-medium">{r.order_number}</TableCell>
                  <TableCell>{r.client?.full_name || r.client?.company || "—"}</TableCell>
                  <TableCell>{r.model_verze || "—"}</TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {[r.rz, r.vin].filter(Boolean).join(" / ") || "—"}
                  </TableCell>
                  <TableCell>
                    {r.datum_objednavky
                      ? new Date(r.datum_objednavky).toLocaleDateString("cs-CZ")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtKc(r.cena_celkem_s_dph)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-block rounded-md border px-2 py-0.5 text-xs font-medium",
                        STATUS_CLASS[r.status] || "bg-muted",
                      )}
                    >
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <RequestDeleteButton
                      entityType="demo_orders"
                      entityId={r.id}
                      entityLabel={`Objednávka ${r.order_number ?? ""}`}
                      size="icon"
                      className="h-8 w-8 text-rose-600"
                      title="Požádat o smazání objednávky"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminShell>
  );
}
