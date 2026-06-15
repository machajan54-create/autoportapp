import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Briefcase, Plus, Pencil, Upload, History } from "lucide-react";
import { RequestDeleteButton } from "@/components/RequestDeleteButton";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  listDeals, createDeal, updateDeal,
  importDeals, listDealStageHistory,
  DEAL_STAGES, DEAL_STAGE_LABEL, DEAL_VEHICLES,
} from "@/lib/deals.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/deals/")({
  component: DealsPage,
});

const STAGE_STYLE: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  offer: "bg-amber-100 text-amber-800",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
};

type DealRow = {
  id: string;
  title: string;
  client_name: string | null;
  contact: string | null;
  value_czk: number | string | null;
  vehicle: string | null;
  stage: string;
  expected_close_date: string | null;
  notes: string | null;
  owner_name: string | null;
  created_at: string;
};

const emptyForm = {
  title: "",
  client_name: "",
  contact: "",
  value_czk: "",
  vehicle: "",
  stage: "lead" as (typeof DEAL_STAGES)[number],
  expected_close_date: "",
  notes: "",
};

function formatCzk(v: number | string | null) {
  if (v === null || v === "" || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);
}

function DealsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listDeals);
  const createFn = useServerFn(createDeal);
  const updateFn = useServerFn(updateDeal);
  const importFn = useServerFn(importDeals);
  const historyFn = useServerFn(listDealStageHistory);

  const { data, isLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: () => fetchList({}),
  });
  const rows = (data?.rows ?? []) as DealRow[];

  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DealRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [historyDeal, setHistoryDeal] = useState<DealRow | null>(null);
  const [history, setHistory] = useState<Array<{
    id: string;
    from_stage: string | null;
    to_stage: string;
    changed_at: string;
    duration_seconds: number | null;
    changed_by_name: string | null;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.stage === filter)),
    [rows, filter],
  );

  const totals = useMemo(() => {
    const open = rows.filter((r) => r.stage !== "won" && r.stage !== "lost");
    const won = rows.filter((r) => r.stage === "won");
    const sum = (xs: DealRow[]) =>
      xs.reduce((acc, r) => acc + (Number(r.value_czk) || 0), 0);
    return { openCount: open.length, openSum: sum(open), wonSum: sum(won) };
  }, [rows]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(r: DealRow) {
    setEditing(r);
    setForm({
      title: r.title ?? "",
      client_name: r.client_name ?? "",
      contact: r.contact ?? "",
      value_czk: r.value_czk == null ? "" : String(r.value_czk),
      vehicle: r.vehicle ?? "",
      stage: (r.stage as (typeof DEAL_STAGES)[number]) ?? "lead",
      expected_close_date: r.expected_close_date ?? "",
      notes: r.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error("Zadejte název případu");
      return;
    }
    const payload = {
      title: form.title.trim(),
      client_name: form.client_name.trim() || null,
      contact: form.contact.trim() || null,
      value_czk: form.value_czk === "" ? null : Number(form.value_czk),
      vehicle: form.vehicle.trim() || null,
      stage: form.stage,
      expected_close_date: form.expected_close_date || null,
      notes: form.notes.trim() || null,
    };
    if (payload.value_czk !== null && !Number.isFinite(payload.value_czk)) {
      toast.error("Neplatná hodnota");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateFn({ data: { id: editing.id, ...payload } });
        toast.success("Uloženo");
      } else {
        await createFn({ data: payload });
        toast.success("Vytvořeno");
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["deals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uložení selhalo");
    } finally {
      setSaving(false);
    }
  }

  async function quickStage(r: DealRow, stage: string) {
    try {
      await updateFn({ data: { id: r.id, stage: stage as (typeof DEAL_STAGES)[number] } });
      toast.success(`Fáze: ${DEAL_STAGE_LABEL[stage]}`);
      qc.invalidateQueries({ queryKey: ["deals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Změna fáze selhala");
    }
  }

  async function openHistory(r: DealRow) {
    setHistoryDeal(r);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await historyFn({ data: { deal_id: r.id } });
      setHistory(res.rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nelze načíst historii");
    } finally {
      setHistoryLoading(false);
    }
  }

  function parseImport(text: string) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [] as Array<{ title: string; client_name?: string; contact?: string; value_czk?: number | null; notes?: string }>;
    const sep = lines[0].includes("\t") ? "\t" : ";";
    const splitRow = (l: string) => l.split(sep).map((c) => c.trim());
    let start = 0;
    const first = splitRow(lines[0]).map((c) => c.toLowerCase());
    const headerKeywords = ["klient", "název", "nazev", "title", "client", "jméno", "jmeno"];
    if (first.some((c) => headerKeywords.includes(c))) start = 1;
    const out: Array<{ title: string; client_name?: string; contact?: string; value_czk?: number | null; notes?: string }> = [];
    for (let i = start; i < lines.length; i++) {
      const cells = splitRow(lines[i]);
      const client = cells[0] || "";
      if (!client) continue;
      const contact = cells[1] || undefined;
      const valueRaw = cells[2] || "";
      const notes = cells[3] || undefined;
      const val = valueRaw ? Number(valueRaw.replace(/\s/g, "").replace(",", ".")) : null;
      out.push({
        title: client,
        client_name: client,
        contact,
        value_czk: val !== null && Number.isFinite(val) ? val : null,
        notes,
      });
    }
    return out;
  }

  async function doImport() {
    const rows = parseImport(importText);
    if (rows.length === 0) {
      toast.error("Žádné platné řádky k importu");
      return;
    }
    setImporting(true);
    try {
      const res = await importFn({ data: { rows } });
      toast.success(`Importováno ${res.count} klientů`);
      setImportOpen(false);
      setImportText("");
      qc.invalidateQueries({ queryKey: ["deals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import selhal");
    } finally {
      setImporting(false);
    }
  }

  return (
    <AdminShell requireModule="deals">
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Obchodní případy</h1>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Nový případ
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> Import klientů
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Otevřené případy</div>
            <div className="mt-1 text-2xl font-semibold">{totals.openCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Hodnota pipeline</div>
            <div className="mt-1 text-2xl font-semibold">{formatCzk(totals.openSum)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Vyhráno (celkem)</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-700">{formatCzk(totals.wonSum)}</div>
          </Card>
        </div>

        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="all">Vše</TabsTrigger>
            {DEAL_STAGES.map((s) => (
              <TabsTrigger key={s} value={s}>{DEAL_STAGE_LABEL[s]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Vůz</TableHead>
                <TableHead>Fáze</TableHead>
                <TableHead>V této fázi</TableHead>
                <TableHead>Uzavření</TableHead>
                <TableHead>Vlastník</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Načítám…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Žádné případy</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.client_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.contact || "—"}</TableCell>
                  <TableCell className="text-xs">{r.vehicle || "—"}</TableCell>
                  <TableCell>
                    <Select value={r.stage} onValueChange={(v) => quickStage(r, v)}>
                      <SelectTrigger className="h-7 w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEAL_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>{DEAL_STAGE_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge className={cn("ml-2 hidden", STAGE_STYLE[r.stage])}>{DEAL_STAGE_LABEL[r.stage]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{stageDurationLabel((r as any).stage_changed_at || r.created_at)}</TableCell>
                  <TableCell className="text-xs">{r.expected_close_date || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.owner_name || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openHistory(r)} aria-label="Historie fází">
                      <History className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Upravit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <RequestDeleteButton
                      entityType="deals"
                      entityId={r.id}
                      entityLabel={`Obchod: ${r.title ?? ""}`}
                      size="icon"
                      title="Požádat o smazání obchodu"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Upravit případ" : "Nový obchodní případ"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Název *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Klient</Label>
                <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div>
                <Label>Kontakt</Label>
                <Input placeholder="telefon / email" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vůz</Label>
                <Select
                  value={form.vehicle || "__none__"}
                  onValueChange={(v) => setForm({ ...form, vehicle: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Vyberte vůz" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Neuvedeno —</SelectItem>
                    {DEAL_VEHICLES.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fáze</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as (typeof DEAL_STAGES)[number] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEAL_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{DEAL_STAGE_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Hodnota (Kč)</Label>
              <Input type="number" min="0" step="1" value={form.value_czk} onChange={(e) => setForm({ ...form, value_czk: e.target.value })} />
            </div>
            <div>
              <Label>Očekávané uzavření</Label>
              <Input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} />
            </div>
            <div>
              <Label>Poznámky</Label>
              <Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Ukládám…" : "Uložit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Import klientů</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Vložte data oddělená středníkem nebo tabulátorem (např. zkopírovaná z Excelu).
              Sloupce: <strong>Klient; Kontakt; Hodnota (Kč); Poznámka</strong>. První řádek může být hlavička.
            </p>
            <Textarea
              rows={10}
              placeholder={"Klient;Kontakt;Hodnota;Poznámka\nJan Novák;jan@firma.cz;120000;První kontakt\nFirma s.r.o.;+420 123 456 789;;Doporučení"}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="text-xs text-muted-foreground">
              Náhled: {parseImport(importText).length} řádků k importu
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Zrušit</Button>
            <Button onClick={doImport} disabled={importing}>{importing ? "Importuji…" : "Importovat"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDeal} onOpenChange={(o) => !o && setHistoryDeal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Historie fází – {historyDeal?.title}</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Načítám…</p>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Žádné záznamy</p>
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-5">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-primary" />
                  <div className="text-sm font-medium">
                    {h.from_stage ? `${DEAL_STAGE_LABEL[h.from_stage] || h.from_stage} → ` : ""}
                    {DEAL_STAGE_LABEL[h.to_stage] || h.to_stage}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.changed_at).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}
                    {h.changed_by_name ? ` · ${h.changed_by_name}` : ""}
                  </div>
                  {h.duration_seconds != null && h.from_stage ? (
                    <div className="text-xs text-muted-foreground">
                      Doba v předchozí fázi: {formatSeconds(h.duration_seconds)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDeal(null)}>Zavřít</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${mins} min`;
  if (mins > 0) return `${mins} min`;
  return `${sec} s`;
}

function stageDurationLabel(since: string | null | undefined): string {
  if (!since) return "—";
  const ms = Date.now() - new Date(since).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  return formatSeconds(Math.floor(ms / 1000));
}