import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Send, X, Droplets, ClipboardList, Info, BellRing } from "lucide-react";
import { getMyAccess } from "@/lib/claims.functions";
import {
  listEvidenceOrders,
  createEvidenceOrder,
  updateEvidenceOrder,
  listWashers,
  createWasher,
  updateWasher,
  deleteWasher,
  assignWasher,
  removeWashAssignment,
} from "@/lib/evidence.functions";

export const Route = createFileRoute("/_authenticated/evidence-zakazek/")({
  component: EvidencePage,
});

const STAV_LABEL: Record<string, { label: string; cls: string }> = {
  nova: { label: "Nová", cls: "bg-blue-100 text-blue-800" },
  predano: { label: "Předáno", cls: "bg-green-100 text-green-800" },
  zruseno: { label: "Zrušeno", cls: "bg-slate-200 text-slate-700" },
};

const WASH_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Čeká", cls: "bg-yellow-100 text-yellow-800" },
  accepted: { label: "Přijato", cls: "bg-green-100 text-green-800" },
  declined: { label: "Odmítnuto", cls: "bg-red-100 text-red-800" },
};

function EvidencePage() {
  const fetchAccess = useServerFn(getMyAccess);
  const { data: access } = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess({}),
  });
  const isAdmin = !!access?.isAdmin;

  return (
    <AdminShell requireModule="evidence_zakazek">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-semibold">Evidence mytí vozů</h1>
          <p className="text-sm text-muted-foreground">
            Plán předávání nových vozů. K zakázce lze přiřadit myče, kteří
            potvrzují převzetí e-mailem.
          </p>
        </header>
        <div className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <div className="font-medium">Jak funguje upozorňování myčů</div>
            <ul className="list-disc space-y-0.5 pl-4 text-blue-900/90">
              <li>
                U každé zakázky vyplňte <strong>Datum vyzvednutí od</strong> a{" "}
                <strong>Datum dokončení do</strong> — myč ví, v jakém okně mytí probíhá.
              </li>
              <li>
                Po přiřazení myče se odešle e-mail s tlačítky <em>Přijímám / Odmítám</em>.
              </li>
              <li>
                Pokud myč nepotvrdí ani neodmítne do 24 hodin, systém každý den
                automaticky pošle připomínku.
              </li>
              <li>
                Připomínky končí ve chvíli, kdy myč potvrdí, odmítne, zakázka je
                zrušena nebo termín dokončení uplynul.
              </li>
            </ul>
          </div>
        </div>
        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">
              <ClipboardList className="mr-2 h-4 w-4" /> Zakázky
            </TabsTrigger>
            <TabsTrigger value="washers">
              <Droplets className="mr-2 h-4 w-4" /> Myči
            </TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-4">
            <OrdersTab />
          </TabsContent>
          <TabsContent value="washers" className="mt-4">
            <WashersTab isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}

function OrdersTab() {
  const fetchOrders = useServerFn(listEvidenceOrders);
  const fetchWashers = useServerFn(listWashers);
  const create = useServerFn(createEvidenceOrder);
  const update = useServerFn(updateEvidenceOrder);
  const assign = useServerFn(assignWasher);
  const removeAssign = useServerFn(removeWashAssignment);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["evidence-orders"],
    queryFn: () => fetchOrders({}),
  });
  const { data: washers } = useQuery({
    queryKey: ["washers"],
    queryFn: () => fetchWashers({}),
  });

  const [open, setOpen] = useState(false);
  const emptyForm = {
    klient: "",
    vozidlo: "",
    vis: "",
    den: "",
    hodina: "",
    kdo_predava: "",
    cislo_zakazky: "",
    poznamka: "",
    pickup_from: "",
    complete_by: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [washerPick, setWasherPick] = useState<string>("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: form });
      toast.success("Zakázka přidána.");
      setOpen(false);
      setForm(emptyForm);
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Chyba při ukládání.");
    }
  }

  async function changeStav(id: string, stav: "nova" | "predano" | "zruseno") {
    try {
      await update({ data: { id, patch: { stav } } });
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Chyba.");
    }
  }

  async function sendAssign() {
    if (!assignTarget || !washerPick) return;
    try {
      await assign({ data: { order_id: assignTarget, washer_id: washerPick } });
      toast.success("E-mail odeslán myči.");
      setAssignTarget(null);
      setWasherPick("");
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Odeslání selhalo.");
    }
  }

  async function dropAssign(id: string) {
    if (!confirm("Odebrat přiřazení myče?")) return;
    try {
      await removeAssign({ data: { id } });
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Chyba.");
    }
  }

  const activeWashers = (washers ?? []).filter((w: any) => w.active);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Plán předávání</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nová zakázka</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nová zakázka</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Label>Klient *</Label><Input required value={form.klient} onChange={(e) => setForm({ ...form, klient: e.target.value })} /></div>
                <div><Label>Vozidlo *</Label><Input required value={form.vozidlo} onChange={(e) => setForm({ ...form, vozidlo: e.target.value })} /></div>
                <div><Label>VIS / SPZ</Label><Input value={form.vis} onChange={(e) => setForm({ ...form, vis: e.target.value })} /></div>
                <div><Label>Vyzvednutí od</Label><Input type="datetime-local" value={form.pickup_from} onChange={(e) => setForm({ ...form, pickup_from: e.target.value })} /></div>
                <div><Label>Dokončit do</Label><Input type="datetime-local" value={form.complete_by} onChange={(e) => setForm({ ...form, complete_by: e.target.value })} /></div>
                <div><Label>Den (orientačně)</Label><Input type="date" value={form.den} onChange={(e) => setForm({ ...form, den: e.target.value })} /></div>
                <div><Label>Hodina</Label><Input placeholder="9:00" value={form.hodina} onChange={(e) => setForm({ ...form, hodina: e.target.value })} /></div>
                <div><Label>Kdo předává</Label><Input value={form.kdo_predava} onChange={(e) => setForm({ ...form, kdo_predava: e.target.value })} /></div>
                <div><Label>Č. zakázky</Label><Input value={form.cislo_zakazky} onChange={(e) => setForm({ ...form, cislo_zakazky: e.target.value })} /></div>
                <div className="col-span-2"><Label>Poznámka</Label><Textarea value={form.poznamka} onChange={(e) => setForm({ ...form, poznamka: e.target.value })} /></div>
              </div>
              <DialogFooter><Button type="submit">Uložit</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Načítám…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">Žádné zakázky.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2">Klient</th>
                  <th className="py-2 pr-2">Vozidlo</th>
                  <th className="py-2 pr-2">VIS</th>
                  <th className="py-2 pr-2">Den</th>
                  <th className="py-2 pr-2">Hodina</th>
                  <th className="py-2 pr-2">Kdo</th>
                  <th className="py-2 pr-2">Č. zakázky</th>
                  <th className="py-2 pr-2">Stav</th>
                  <th className="py-2 pr-2">Mytí</th>
                </tr>
              </thead>
              <tbody>
                {data.map((o: any) => {
                  const stav = STAV_LABEL[o.stav] ?? STAV_LABEL.nova;
                  return (
                    <tr key={o.id} className="border-t align-top">
                      <td className="py-2 pr-2 font-medium">{o.klient}</td>
                      <td className="py-2 pr-2">{o.vozidlo}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{o.vis ?? "—"}</td>
                      <td className="py-2 pr-2">{o.den ? new Date(o.den).toLocaleDateString("cs-CZ") : "—"}</td>
                      <td className="py-2 pr-2">{o.hodina ?? "—"}</td>
                      <td className="py-2 pr-2">{o.kdo_predava ?? "—"}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{o.cislo_zakazky ?? "—"}</td>
                      <td className="py-2 pr-2">
                        <Select value={o.stav} onValueChange={(v: any) => changeStav(o.id, v)}>
                          <SelectTrigger className="h-8 w-32">
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${stav.cls}`}>{stav.label}</span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nova">Nová</SelectItem>
                            <SelectItem value="predano">Předáno</SelectItem>
                            <SelectItem value="zruseno">Zrušeno</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex flex-col gap-1">
                          {(o.assignments ?? []).map((a: any) => {
                            const w = WASH_LABEL[a.status] ?? WASH_LABEL.pending;
                            return (
                              <div key={a.id} className="flex items-center gap-1">
                                <Badge className={w.cls + " hover:" + w.cls} variant="outline">
                                  {a.washer?.name ?? "?"} · {w.label}
                                </Badge>
                                <button
                                  type="button"
                                  onClick={() => dropAssign(a.id)}
                                  className="text-muted-foreground hover:text-destructive"
                                  title="Odebrat"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() => { setAssignTarget(o.id); setWasherPick(""); }}
                          >
                            <Send className="mr-1 h-3 w-3" /> Přiřadit myče
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Přiřadit myče</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!activeWashers.length ? (
              <p className="text-sm text-muted-foreground">
                Žádní aktivní myči. Přidejte je v záložce „Myči".
              </p>
            ) : (
              <>
                <Label>Myč</Label>
                <Select value={washerPick} onValueChange={setWasherPick}>
                  <SelectTrigger><SelectValue placeholder="Vyberte myče" /></SelectTrigger>
                  <SelectContent>
                    {activeWashers.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Po odeslání obdrží myč e-mail s tlačítky Přijímám / Odmítám.
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignTarget(null)}>Zrušit</Button>
            <Button disabled={!washerPick} onClick={sendAssign}>
              <Send className="mr-1 h-4 w-4" /> Odeslat e-mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function WashersTab({ isAdmin }: { isAdmin: boolean }) {
  const fetchList = useServerFn(listWashers);
  const create = useServerFn(createWasher);
  const update = useServerFn(updateWasher);
  const remove = useServerFn(deleteWasher);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["washers"],
    queryFn: () => fetchList({}),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: { ...form, active: true } });
      toast.success("Myč přidán.");
      setOpen(false);
      setForm({ name: "", email: "" });
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Chyba.");
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      await update({ data: { id, patch: { active } } });
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Chyba.");
    }
  }

  async function del(id: string) {
    if (!confirm("Opravdu smazat myče?")) return;
    try {
      await remove({ data: { id } });
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Chyba.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Myči</CardTitle>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nový myč</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nový myč</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div><Label>Jméno *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>E-mail *</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <DialogFooter><Button type="submit">Uložit</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {!isAdmin && (
          <p className="mb-3 text-xs text-muted-foreground">
            Seznam myčů spravuje pouze super admin.
          </p>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Načítám…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">Žádní myči.</p>
        ) : (
          <div className="space-y-2">
            {data.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium">{w.name}</div>
                    {!w.active && <Badge variant="secondary">Neaktivní</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{w.email}</div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => toggleActive(w.id, !w.active)}>
                      {w.active ? "Deaktivovat" : "Aktivovat"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => del(w.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}