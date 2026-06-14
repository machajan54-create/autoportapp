import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, Plus, Pencil, Trash2, Car, Fuel, Route as RouteIcon } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  listVehicles, upsertVehicle, deleteVehicle,
  listEntries, upsertEntry, deleteEntry,
} from "@/lib/logbook.functions";

export const Route = createFileRoute("/_authenticated/logbook/")({
  component: LogbookPage,
});

type Vehicle = {
  id: string;
  type: string;
  spz: string | null;
  body_number: string | null;
  responsible_person: string | null;
  active: boolean;
};

type Entry = {
  id: string;
  vehicle_id: string;
  entry_date: string;
  route: string | null;
  purpose: string | null;
  km_driven: number | string | null;
  odometer: number | string | null;
  fuel_liters: number | string | null;
  fuel_cost_czk: number | string | null;
  note: string | null;
  created_by_name: string | null;
};

const emptyVehicle = { type: "", spz: "", body_number: "", responsible_person: "", active: true };
const today = () => new Date().toISOString().slice(0, 10);
const emptyEntry = {
  entry_date: today(),
  route: "",
  purpose: "",
  km_driven: "",
  odometer: "",
  fuel_liters: "",
  fuel_cost_czk: "",
  note: "",
};

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number | string | null | undefined, suffix = "") {
  const v = num(n);
  if (v === null) return "—";
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(v) + (suffix ? ` ${suffix}` : "");
}

function fmtCzk(n: number | string | null | undefined) {
  const v = num(n);
  if (v === null) return "—";
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 2 }).format(v);
}

function LogbookPage() {
  const qc = useQueryClient();
  const fetchVehicles = useServerFn(listVehicles);
  const fetchEntries = useServerFn(listEntries);
  const saveVehicleFn = useServerFn(upsertVehicle);
  const deleteVehicleFn = useServerFn(deleteVehicle);
  const saveEntryFn = useServerFn(upsertEntry);
  const deleteEntryFn = useServerFn(deleteEntry);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | "all">("all");

  const { data: vData, isLoading: vLoading } = useQuery({
    queryKey: ["logbook-vehicles"],
    queryFn: () => fetchVehicles({}),
  });
  const vehicles = (vData?.rows ?? []) as Vehicle[];

  const { data: eData, isLoading: eLoading } = useQuery({
    queryKey: ["logbook-entries", selectedVehicleId],
    queryFn: () =>
      fetchEntries({ data: selectedVehicleId === "all" ? {} : { vehicle_id: selectedVehicleId } }),
  });
  const entries = (eData?.rows ?? []) as Entry[];

  const vehicleById = useMemo(() => {
    const m = new Map<string, Vehicle>();
    vehicles.forEach((v) => m.set(v.id, v));
    return m;
  }, [vehicles]);

  const selectedVehicle = selectedVehicleId === "all" ? null : vehicleById.get(selectedVehicleId) ?? null;

  const totals = useMemo(() => {
    let km = 0, liters = 0, cost = 0;
    for (const e of entries) {
      km += num(e.km_driven) ?? 0;
      liters += num(e.fuel_liters) ?? 0;
      cost += num(e.fuel_cost_czk) ?? 0;
    }
    return { km, liters, cost, count: entries.length };
  }, [entries]);

  // Vehicle dialog
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vForm, setVForm] = useState({ ...emptyVehicle });
  const [vSaving, setVSaving] = useState(false);

  function openCreateVehicle() {
    setEditingVehicle(null);
    setVForm({ ...emptyVehicle });
    setVehicleOpen(true);
  }
  function openEditVehicle(v: Vehicle) {
    setEditingVehicle(v);
    setVForm({
      type: v.type ?? "",
      spz: v.spz ?? "",
      body_number: v.body_number ?? "",
      responsible_person: v.responsible_person ?? "",
      active: v.active,
    });
    setVehicleOpen(true);
  }

  async function saveVehicle() {
    if (!vForm.type.trim()) {
      toast.error("Zadejte typ vozidla");
      return;
    }
    setVSaving(true);
    try {
      await saveVehicleFn({
        data: {
          ...(editingVehicle ? { id: editingVehicle.id } : {}),
          type: vForm.type.trim(),
          spz: vForm.spz.trim() || null,
          body_number: vForm.body_number.trim() || null,
          responsible_person: vForm.responsible_person.trim() || null,
          active: vForm.active,
        },
      });
      toast.success("Vozidlo uloženo");
      setVehicleOpen(false);
      qc.invalidateQueries({ queryKey: ["logbook-vehicles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uložení selhalo");
    } finally {
      setVSaving(false);
    }
  }

  async function removeVehicle(v: Vehicle) {
    if (!confirm(`Smazat vozidlo "${v.type}" včetně všech jízd a tankování?`)) return;
    try {
      await deleteVehicleFn({ data: { id: v.id } });
      toast.success("Vozidlo smazáno");
      if (selectedVehicleId === v.id) setSelectedVehicleId("all");
      qc.invalidateQueries({ queryKey: ["logbook-vehicles"] });
      qc.invalidateQueries({ queryKey: ["logbook-entries"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Smazání selhalo");
    }
  }

  // Entry dialog
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [entryVehicleId, setEntryVehicleId] = useState<string>("");
  const [eForm, setEForm] = useState({ ...emptyEntry });
  const [eSaving, setESaving] = useState(false);

  function openCreateEntry() {
    if (vehicles.length === 0) {
      toast.error("Nejdřív přidejte vozidlo");
      return;
    }
    const defaultVehicle = selectedVehicleId !== "all" ? selectedVehicleId : vehicles[0]?.id ?? "";
    setEditingEntry(null);
    setEntryVehicleId(defaultVehicle);
    setEForm({ ...emptyEntry, entry_date: today() });
    setEntryOpen(true);
  }

  function openEditEntry(e: Entry) {
    setEditingEntry(e);
    setEntryVehicleId(e.vehicle_id);
    setEForm({
      entry_date: e.entry_date,
      route: e.route ?? "",
      purpose: e.purpose ?? "",
      km_driven: e.km_driven == null ? "" : String(e.km_driven),
      odometer: e.odometer == null ? "" : String(e.odometer),
      fuel_liters: e.fuel_liters == null ? "" : String(e.fuel_liters),
      fuel_cost_czk: e.fuel_cost_czk == null ? "" : String(e.fuel_cost_czk),
      note: e.note ?? "",
    });
    setEntryOpen(true);
  }

  async function saveEntry() {
    if (!entryVehicleId) {
      toast.error("Vyberte vozidlo");
      return;
    }
    if (!eForm.entry_date) {
      toast.error("Vyberte datum");
      return;
    }
    const km = num(eForm.km_driven);
    const liters = num(eForm.fuel_liters);
    if (km === null && liters === null) {
      toast.error("Vyplňte alespoň najeté KM nebo natankováno (l)");
      return;
    }
    setESaving(true);
    try {
      await saveEntryFn({
        data: {
          ...(editingEntry ? { id: editingEntry.id } : {}),
          vehicle_id: entryVehicleId,
          entry_date: eForm.entry_date,
          route: eForm.route.trim() || null,
          purpose: eForm.purpose.trim() || null,
          km_driven: km,
          odometer: num(eForm.odometer),
          fuel_liters: liters,
          fuel_cost_czk: num(eForm.fuel_cost_czk),
          note: eForm.note.trim() || null,
        },
      });
      toast.success("Záznam uložen");
      setEntryOpen(false);
      qc.invalidateQueries({ queryKey: ["logbook-entries"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uložení selhalo");
    } finally {
      setESaving(false);
    }
  }

  async function removeEntry(e: Entry) {
    if (!confirm("Smazat záznam?")) return;
    try {
      await deleteEntryFn({ data: { id: e.id } });
      toast.success("Smazáno");
      qc.invalidateQueries({ queryKey: ["logbook-entries"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání selhalo");
    }
  }

  return (
    <AdminShell requireModule="logbook">
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Kniha jízd</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openCreateVehicle}>
              <Car className="mr-1 h-4 w-4" /> Nové vozidlo
            </Button>
            <Button onClick={openCreateEntry}>
              <Plus className="mr-1 h-4 w-4" /> Nový záznam
            </Button>
          </div>
        </div>

        {/* Vehicle filter / cards */}
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground">Vozidlo:</Label>
            <Select value={selectedVehicleId} onValueChange={(v) => setSelectedVehicleId(v as string)}>
              <SelectTrigger className="h-8 w-[260px]">
                <SelectValue placeholder="Vyberte vozidlo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechna vozidla</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.type}{v.spz ? ` · ${v.spz}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVehicle && (
              <div className="ml-auto flex items-center gap-2 text-xs">
                <Badge variant="outline">RZ: {selectedVehicle.spz || "—"}</Badge>
                <Badge variant="outline">Karoserie: {selectedVehicle.body_number || "—"}</Badge>
                <Badge variant="outline">Osoba: {selectedVehicle.responsible_person || "—"}</Badge>
                <Button size="sm" variant="ghost" onClick={() => openEditVehicle(selectedVehicle)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeVehicle(selectedVehicle)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><RouteIcon className="h-3.5 w-3.5" />Záznamů</div>
            <div className="mt-1 text-2xl font-semibold">{totals.count}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Najeto celkem</div>
            <div className="mt-1 text-2xl font-semibold">{fmt(totals.km, "km")}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Fuel className="h-3.5 w-3.5" />Natankováno</div>
            <div className="mt-1 text-2xl font-semibold">{fmt(totals.liters, "l")}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Náklady na PHM</div>
            <div className="mt-1 text-2xl font-semibold">{fmtCzk(totals.cost)}</div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Záznamy
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                {selectedVehicleId === "all" && <TableHead>Vozidlo</TableHead>}
                <TableHead>Trasa</TableHead>
                <TableHead>Účel</TableHead>
                <TableHead className="text-right">Najeto KM</TableHead>
                <TableHead className="text-right">Stav tachometru</TableHead>
                <TableHead className="text-right">PHM (l)</TableHead>
                <TableHead className="text-right">Kč</TableHead>
                <TableHead>Zapsal</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(eLoading || vLoading) && (
                <TableRow><TableCell colSpan={selectedVehicleId === "all" ? 10 : 9} className="py-8 text-center text-sm text-muted-foreground">Načítám…</TableCell></TableRow>
              )}
              {!eLoading && entries.length === 0 && (
                <TableRow><TableCell colSpan={selectedVehicleId === "all" ? 10 : 9} className="py-8 text-center text-sm text-muted-foreground">Žádné záznamy</TableCell></TableRow>
              )}
              {entries.map((e) => {
                const v = vehicleById.get(e.vehicle_id);
                const isRefuel = num(e.fuel_liters) !== null;
                return (
                  <TableRow key={e.id} className={isRefuel ? "bg-amber-50/40" : undefined}>
                    <TableCell className="whitespace-nowrap">{e.entry_date}</TableCell>
                    {selectedVehicleId === "all" && (
                      <TableCell className="whitespace-nowrap text-xs">
                        {v ? `${v.type}${v.spz ? ` · ${v.spz}` : ""}` : "—"}
                      </TableCell>
                    )}
                    <TableCell>{e.route || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.purpose || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(e.km_driven)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(e.odometer)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(e.fuel_liters)}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.fuel_cost_czk == null ? "—" : fmtCzk(e.fuel_cost_czk)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.created_by_name || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditEntry(e)} aria-label="Upravit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeEntry(e)} aria-label="Smazat">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {vehicles.length > 0 && (
          <Card className="overflow-hidden">
            <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vozidla
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>RZ</TableHead>
                  <TableHead>Číslo karoserie</TableHead>
                  <TableHead>Odpovědná osoba</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.type}</TableCell>
                    <TableCell>{v.spz || "—"}</TableCell>
                    <TableCell>{v.body_number || "—"}</TableCell>
                    <TableCell>{v.responsible_person || "—"}</TableCell>
                    <TableCell>
                      {v.active ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Aktivní</Badge>
                        : <Badge variant="outline">Neaktivní</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditVehicle(v)} aria-label="Upravit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeVehicle(v)} aria-label="Smazat">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Vehicle dialog */}
      <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? "Upravit vozidlo" : "Nové vozidlo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Typ vozidla *</Label>
              <Input placeholder="např. Berlingo" value={vForm.type} onChange={(e) => setVForm({ ...vForm, type: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RZ (SPZ)</Label>
                <Input value={vForm.spz} onChange={(e) => setVForm({ ...vForm, spz: e.target.value })} />
              </div>
              <div>
                <Label>Číslo karoserie</Label>
                <Input value={vForm.body_number} onChange={(e) => setVForm({ ...vForm, body_number: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Odpovědná osoba</Label>
              <Input value={vForm.responsible_person} onChange={(e) => setVForm({ ...vForm, responsible_person: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={vForm.active} onChange={(e) => setVForm({ ...vForm, active: e.target.checked })} />
              Aktivní
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehicleOpen(false)}>Zrušit</Button>
            <Button onClick={saveVehicle} disabled={vSaving}>{vSaving ? "Ukládám…" : "Uložit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entry dialog */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Upravit záznam" : "Nový záznam (jízda / tankování)"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vozidlo *</Label>
                <Select value={entryVehicleId} onValueChange={setEntryVehicleId}>
                  <SelectTrigger><SelectValue placeholder="Vyberte" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.type}{v.spz ? ` · ${v.spz}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Datum *</Label>
                <Input type="date" value={eForm.entry_date} onChange={(e) => setEForm({ ...eForm, entry_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Trasa</Label>
              <Input placeholder="např. Praha – Brno" value={eForm.route} onChange={(e) => setEForm({ ...eForm, route: e.target.value })} />
            </div>
            <div>
              <Label>Účel</Label>
              <Input placeholder="např. servisní cesta" value={eForm.purpose} onChange={(e) => setEForm({ ...eForm, purpose: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Najeto (km)</Label>
                <Input type="number" inputMode="decimal" step="0.1" min="0" value={eForm.km_driven} onChange={(e) => setEForm({ ...eForm, km_driven: e.target.value })} />
              </div>
              <div>
                <Label>Stav tachometru</Label>
                <Input type="number" inputMode="decimal" step="0.1" min="0" value={eForm.odometer} onChange={(e) => setEForm({ ...eForm, odometer: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-md border border-amber-200 bg-amber-50/50 p-3">
              <div>
                <Label>Tankování – PHM (l)</Label>
                <Input type="number" inputMode="decimal" step="0.01" min="0" value={eForm.fuel_liters} onChange={(e) => setEForm({ ...eForm, fuel_liters: e.target.value })} />
              </div>
              <div>
                <Label>Cena (Kč)</Label>
                <Input type="number" inputMode="decimal" step="0.01" min="0" value={eForm.fuel_cost_czk} onChange={(e) => setEForm({ ...eForm, fuel_cost_czk: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Poznámka</Label>
              <Textarea rows={3} value={eForm.note} onChange={(e) => setEForm({ ...eForm, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryOpen(false)}>Zrušit</Button>
            <Button onClick={saveEntry} disabled={eSaving}>{eSaving ? "Ukládám…" : "Uložit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}