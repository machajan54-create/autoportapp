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
import { Plus, Search, Pencil, Trash2, Car } from "lucide-react";
import {
  listVykupy, deleteVykup, formatKc, formatDate, marze, stavBadge,
} from "@/lib/vykupy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vykupy/")({
  component: VykupyList,
});

function VykupyList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["vykupy"], queryFn: listVykupy });

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
    <AdminShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Divize Ojeté Vozy
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Car className="h-7 w-7 text-orange-500" />
            Výkupy
          </h1>
          <Button
            onClick={() => navigate({ to: "/vykupy/$id", params: { id: "novy" } })}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            <Plus className="mr-1 h-4 w-4" />
            Nový výkup
          </Button>
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

        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
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
                      <span className={cn("inline-block rounded-md border px-2 py-0.5 text-xs font-medium", stavBadge[v.stav] ?? "bg-muted")}>
                        {v.stav}
                      </span>
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
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => onDelete(v.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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