import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, Car, BarChart3 } from "lucide-react";
import {
  listVykupy, deleteVykup, formatKc, formatDate, marze, stavBadge,
} from "@/lib/vykupy";
import { getMyAccess } from "@/lib/claims.functions";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vykupy/")({
  component: VykupyList,
});

function VykupyList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["vykupy"], queryFn: listVykupy });
  const fetchAccess = useServerFn(getMyAccess);
  const { data: access } = useQuery({ queryKey: ["my-access"], queryFn: () => fetchAccess({}) });
  const modules = (access?.modules ?? []) as string[];
  const canFull = !!access?.isAdmin || modules.includes("vykupy");

  const rows = (data ?? []).filter((v) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return v.klient.toLowerCase().includes(t) || v.model.toLowerCase().includes(t);
  });

  async function onDelete(id: string) {
    if (!confirm("Opravdu smazat tento výkup?")) return;
    try {
      await deleteVykup(id);
      toast.success("Smazáno");
      qc.invalidateQueries({ queryKey: ["vykupy"] });
    } catch (e) {
      toast.error("Chyba při mazání");
    }
  }

  return (
    <AdminShell requireModule={["vykupy", "vykupy_external"]}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Divize Ojeté Vozy
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Car className="h-7 w-7 text-orange-500" />
            Výkupy
          </h1>
          {canFull && (
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/vykupy/dashboard">
                  <BarChart3 className="mr-1 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button
                onClick={() => navigate({ to: "/vykupy/$id", params: { id: "novy" } })}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                <Plus className="mr-1 h-4 w-4" />
                Nový výkup
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border bg-card p-3">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat klient nebo model…"
              className="h-9 pl-8"
            />
          </div>
        </div>

        {/* Mobile: card list */}
        <div className="mt-4 space-y-2 md:hidden">
          {isLoading && (
            <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">Načítám…</div>
          )}
          {!isLoading && rows.length === 0 && (
            <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">Žádné záznamy.</div>
          )}
          {rows.map((v) => {
            const m = marze(v);
            return (
              <button
                key={v.id}
                onClick={() => navigate({ to: "/vykupy/$id", params: { id: v.id } })}
                className="w-full rounded-xl border bg-card p-3 text-left active:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{v.znacka} {v.model}</div>
                    <div className="truncate text-sm text-muted-foreground">{v.klient}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", stavBadge[v.stav] ?? "bg-muted")}>
                      {v.stav}
                    </span>
                    {v.stav_changed_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {daysInStav(v.stav_changed_at)} d ve stavu
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  <div className="text-muted-foreground">{formatDate(v.datum_vykupu)}{v.zpracoval ? ` · ${v.zpracoval}` : ""}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="tabular-nums">{formatKc(v.vykoupeno_za)}</span>
                    {m != null && (
                      <span className={cn("tabular-nums font-medium", m < 0 && "text-rose-600", m > 0 && "text-emerald-600")}>
                        {m > 0 ? "+" : ""}{formatKc(m)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Desktop: table */}
        <div className="mt-4 hidden overflow-hidden rounded-xl border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Značka</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead className="text-right">Vykoupeno za</TableHead>
                <TableHead className="text-right">Marže</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Zpracoval</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Načítám…</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Žádné záznamy.</TableCell></TableRow>
              )}
              {rows.map((v) => {
                const m = marze(v);
                return (
                  <TableRow key={v.id} className="cursor-pointer" onClick={() => navigate({ to: "/vykupy/$id", params: { id: v.id } })}>
                    <TableCell className="font-medium">{v.znacka}</TableCell>
                    <TableCell>{v.model}</TableCell>
                    <TableCell>{v.klient}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatKc(v.vykoupeno_za)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums font-medium", m != null && m < 0 && "text-rose-600", m != null && m > 0 && "text-emerald-600")}>
                      {m == null ? "—" : formatKc(m)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className={cn("inline-block w-fit rounded-md border px-2 py-0.5 text-xs font-medium", stavBadge[v.stav] ?? "bg-muted")}>
                          {v.stav}
                        </span>
                        {v.stav_changed_at && (
                          <span className="text-[10px] text-muted-foreground">
                            {daysInStav(v.stav_changed_at)} d
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{v.zpracoval ?? "—"}</TableCell>
                    <TableCell>{formatDate(v.datum_vykupu)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                          <Link to="/vykupy/$id" params={{ id: v.id }}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canFull && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => onDelete(v.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminShell>
  );
}