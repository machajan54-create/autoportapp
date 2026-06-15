import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, FileText, FileSignature, Mail, Trash2, Plus, Loader2, Download, Link as LinkIcon, Lock, Activity } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import {
  getDemoOrder, createDemoOrder, updateDemoOrder,
  generateOrderPdf, generateInvoicePdf,
  signOrderInPerson, createRemoteSignatureLink,
  sendDocumentsToClient, getDocumentDownloadUrl,
  saveSellerSignature, clearSellerSignature,
} from "@/lib/demo-orders.functions";
import { listClients, createClient } from "@/lib/clients.functions";
import { getMyAccess } from "@/lib/claims.functions";
import { RequestDeleteButton } from "@/components/RequestDeleteButton";

export const Route = createFileRoute("/_authenticated/demo-orders/$id")({
  component: DemoOrderForm,
});

type LineItem = { label: string; category: string; bez_dph: number; dph_pct: number };

const STATUS_LABEL: Record<string, string> = {
  draft: "Koncept",
  sent_for_signature: "Čeká na podpis",
  signed: "Podepsáno",
  cancelled: "Zrušeno",
};

const KIND_LABEL: Record<string, string> = {
  order: "Objednávka",
  order_signed: "Objednávka (podepsaná)",
  invoice: "Zálohová faktura",
  invoice_signed: "Faktura (podepsaná)",
};

function fmtKc(n: number) {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function emptyForm() {
  return {
    client_id: "",
    model_verze: "",
    vin: "",
    rz: "",
    barva: "",
    najete_km: "" as string,
    rok_vyroby: "" as string,
    zaruka_spustena_od: "",
    registrace_datum: "",
    datum_objednavky: todayISO(),
    datum_dodani: "",
    line_items: [
      { label: "Vozidlo (základní cena)", category: "vehicle", bez_dph: 0, dph_pct: 21 },
    ] as LineItem[],
    zaloha: 0,
    notes: "",
  };
}

function DemoOrderForm() {
  const { id } = useParams({ from: "/_authenticated/demo-orders/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = id === "novy";

  const fetchOrder = useServerFn(getDemoOrder);
  const createFn = useServerFn(createDemoOrder);
  const updateFn = useServerFn(updateDemoOrder);
  const genOrder = useServerFn(generateOrderPdf);
  const genInvoice = useServerFn(generateInvoicePdf);
  const signLocal = useServerFn(signOrderInPerson);
  const signRemote = useServerFn(createRemoteSignatureLink);
  const sendDocs = useServerFn(sendDocumentsToClient);
  const getDocUrl = useServerFn(getDocumentDownloadUrl);
  const saveSeller = useServerFn(saveSellerSignature);
  const clearSeller = useServerFn(clearSellerSignature);
  const fetchClients = useServerFn(listClients);
  const createClientFn = useServerFn(createClient);
  const fetchAccess = useServerFn(getMyAccess);
  const { data: access } = useQuery({ queryKey: ["my-access"], queryFn: () => fetchAccess({}) });
  const isAdmin = !!access?.isAdmin;

  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [sigData, setSigData] = useState<string | null>(null);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [sellerName, setSellerName] = useState("");
  const [sellerSig, setSellerSig] = useState<string | null>(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ full_name: "", company: "", email: "", phone: "", ico: "", dic: "", address: "" });

  const { data: orderData, isLoading } = useQuery({
    queryKey: ["demo-order", id],
    queryFn: () => fetchOrder({ data: { id } }),
    enabled: !isNew,
  });
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: () => fetchClients({}) });
  const clients = clientsData?.rows ?? [];

  useEffect(() => {
    if (orderData?.order) {
      const o = orderData.order;
      setForm({
        client_id: o.client_id || "",
        model_verze: o.model_verze || "",
        vin: o.vin || "",
        rz: o.rz || "",
        barva: o.barva || "",
        najete_km: o.najete_km != null ? String(o.najete_km) : "",
        rok_vyroby: o.rok_vyroby != null ? String(o.rok_vyroby) : "",
        zaruka_spustena_od: o.zaruka_spustena_od || "",
        registrace_datum: o.registrace_datum || "",
        datum_objednavky: o.datum_objednavky || todayISO(),
        datum_dodani: o.datum_dodani || "",
        line_items: Array.isArray(o.line_items) && o.line_items.length ? o.line_items : emptyForm().line_items,
        zaloha: Number(o.zaloha || 0),
        notes: o.notes || "",
      });
    }
  }, [orderData?.order?.id]);

  const totals = useMemo(() => {
    let bez = 0, s = 0;
    for (const it of form.line_items) {
      const b = Number(it.bez_dph || 0);
      bez += b;
      s += b * (1 + Number(it.dph_pct || 0) / 100);
    }
    return { bez, s };
  }, [form.line_items]);

  function payload() {
    return {
      client_id: form.client_id,
      model_verze: form.model_verze || null,
      vin: form.vin || null,
      rz: form.rz || null,
      barva: form.barva || null,
      najete_km: form.najete_km ? Number(form.najete_km) : null,
      rok_vyroby: form.rok_vyroby ? Number(form.rok_vyroby) : null,
      zaruka_spustena_od: form.zaruka_spustena_od || null,
      registrace_datum: form.registrace_datum || null,
      datum_objednavky: form.datum_objednavky || todayISO(),
      datum_dodani: form.datum_dodani || null,
      line_items: form.line_items.map((x) => ({
        label: x.label, category: x.category as any,
        bez_dph: Number(x.bez_dph || 0), dph_pct: Number(x.dph_pct || 0),
      })),
      zaloha: Number(form.zaloha || 0),
      notes: form.notes || null,
    };
  }

  async function onSave() {
    if (!form.client_id) { toast.error("Vyberte klienta"); return; }
    setSaving(true);
    try {
      if (isNew) {
        const r = await createFn({ data: payload() });
        toast.success("Objednávka vytvořena");
        qc.invalidateQueries({ queryKey: ["demo-orders"] });
        navigate({ to: "/demo-orders/$id", params: { id: r.id } });
      } else {
        await updateFn({ data: { id, ...payload() } });
        toast.success("Uloženo");
        qc.invalidateQueries({ queryKey: ["demo-order", id] });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  async function runBusy(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  function downloadBase64(base64: string, name: string) {
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function onGenerateOrder() {
    await runBusy("gen-order", async () => {
      const r = await genOrder({ data: { orderId: id } });
      downloadBase64(r.base64, r.file_name);
      toast.success("PDF objednávky vygenerováno");
      qc.invalidateQueries({ queryKey: ["demo-order", id] });
    });
  }
  async function onGenerateInvoice() {
    await runBusy("gen-invoice", async () => {
      const r = await genInvoice({ data: { orderId: id } });
      downloadBase64(r.base64, r.file_name);
      toast.success(`Zálohová faktura ${r.invoiceNumber} vygenerována`);
      qc.invalidateQueries({ queryKey: ["demo-order", id] });
    });
  }
  async function onSignInPerson() {
    if (!signerName.trim() || !sigData) { toast.error("Doplňte jméno a podpis"); return; }
    await runBusy("sign-local", async () => {
      await signLocal({ data: { orderId: id, signatureDataUrl: sigData!, signerName: signerName.trim() } });
      toast.success("Podepsáno");
      setSignOpen(false); setSigData(null); setSignerName("");
      qc.invalidateQueries({ queryKey: ["demo-order", id] });
    });
  }

  async function onSaveSellerSignature() {
    if (!sellerName.trim() || !sellerSig) { toast.error("Doplňte jméno a podpis"); return; }
    await runBusy("sign-seller", async () => {
      await saveSeller({ data: { orderId: id, signatureDataUrl: sellerSig!, signerName: sellerName.trim() } });
      toast.success("Podpis prodejce uložen");
      setSellerOpen(false); setSellerSig(null); setSellerName("");
      qc.invalidateQueries({ queryKey: ["demo-order", id] });
    });
  }

  async function onClearSellerSignature() {
    if (!confirm("Opravdu odstranit podpis prodejce?")) return;
    await runBusy("clear-seller", async () => {
      await clearSeller({ data: { orderId: id } });
      toast.success("Podpis prodejce odstraněn");
      qc.invalidateQueries({ queryKey: ["demo-order", id] });
    });
  }

  async function onSendSignLink() {
    await runBusy("sign-remote", async () => {
      const r = await signRemote({ data: { orderId: id } });
      toast.success("Odkaz pro podpis odeslán klientovi");
      navigator.clipboard?.writeText(r.signUrl).catch(() => {});
      qc.invalidateQueries({ queryKey: ["demo-order", id] });
    });
  }
  async function onSendDocs() {
    await runBusy("send-docs", async () => {
      await sendDocs({ data: { orderId: id } });
      toast.success("Dokumenty odeslány klientovi");
    });
  }
  async function onOpenDoc(docId: string) {
    // Pre-open window synchronously to avoid popup blocker after await.
    const win = window.open("", "_blank");
    try {
      const r = await getDocUrl({ data: { documentId: docId } });
      if (win) win.location.href = r.url;
      else window.location.href = r.url;
    } catch (e) {
      if (win) win.close();
      toast.error((e as Error).message);
    }
  }

  async function onCreateClient() {
    if (!newClient.full_name && !newClient.company) { toast.error("Vyplňte jméno nebo firmu"); return; }
    try {
      const r = await createClientFn({ data: newClient });
      toast.success("Klient vytvořen");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setForm((f) => ({ ...f, client_id: r.id }));
      setClientOpen(false);
      setNewClient({ full_name: "", company: "", email: "", phone: "", ico: "", dic: "", address: "" });
    } catch (e) { toast.error((e as Error).message); }
  }

  if (!isNew && isLoading) {
    return (
      <AdminShell requireModule="demo_orders">
        <div className="p-10 text-center text-muted-foreground">Načítám…</div>
      </AdminShell>
    );
  }

  const order = orderData?.order;
  const client = orderData?.client;
  const docs = orderData?.documents ?? [];

  const updateItem = (i: number, patch: Partial<LineItem>) => {
    setForm((f) => ({ ...f, line_items: f.line_items.map((it, idx) => idx === i ? { ...it, ...patch } : it) }));
  };
  const removeItem = (i: number) => setForm((f) => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) }));
  const addItem = () => setForm((f) => ({ ...f, line_items: [...f.line_items, { label: "", category: "equipment", bez_dph: 0, dph_pct: 21 }] }));

  return (
    <AdminShell requireModule="demo_orders">
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/demo-orders" })} className="mb-3">
          <ArrowLeft className="mr-1 h-4 w-4" /> Zpět na seznam
        </Button>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">
              {isNew ? "Nová objednávka" : order?.order_number}
            </h1>
            {!isNew && (
              <p className="text-sm text-muted-foreground">Stav: {STATUS_LABEL[order?.status] || order?.status}</p>
            )}
          </div>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {isNew ? "Vytvořit" : "Uložit"}
          </Button>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {/* Left: form */}
          <div className="md:col-span-2 space-y-6">
            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 font-semibold">Klient</h2>
              <div className="flex gap-2">
                <select
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— vyberte klienta —</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {[c.full_name, c.company].filter(Boolean).join(" — ") || c.email || c.id}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" onClick={() => setClientOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Nový
                </Button>
              </div>
              {client && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {client.email || "—"} · {client.phone || "—"} · IČ {client.ico || "—"}
                </p>
              )}
            </section>

            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 font-semibold">Vozidlo</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Model a verze"><Input value={form.model_verze} onChange={(e) => setForm({ ...form, model_verze: e.target.value })} /></Field>
                <Field label="Barva"><Input value={form.barva} onChange={(e) => setForm({ ...form, barva: e.target.value })} /></Field>
                <Field label="RZ (SPZ)"><Input value={form.rz} onChange={(e) => setForm({ ...form, rz: e.target.value })} /></Field>
                <Field label="VIN"><Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} /></Field>
                <Field label="Rok výroby"><Input type="number" value={form.rok_vyroby} onChange={(e) => setForm({ ...form, rok_vyroby: e.target.value })} /></Field>
                <Field label="Najeté km"><Input type="number" value={form.najete_km} onChange={(e) => setForm({ ...form, najete_km: e.target.value })} /></Field>
                <Field label="Záruka spuštěna od"><Input value={form.zaruka_spustena_od} onChange={(e) => setForm({ ...form, zaruka_spustena_od: e.target.value })} placeholder="např. 1. registrace" /></Field>
                <Field label="Registrace vozu"><Input type="date" value={form.registrace_datum} onChange={(e) => setForm({ ...form, registrace_datum: e.target.value })} /></Field>
                <Field label="Datum objednávky"><Input type="date" value={form.datum_objednavky} onChange={(e) => setForm({ ...form, datum_objednavky: e.target.value })} /></Field>
                <Field label="Datum dodání"><Input type="date" value={form.datum_dodani} onChange={(e) => setForm({ ...form, datum_dodani: e.target.value })} /></Field>
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Ceník</h2>
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="mr-1 h-3 w-3" /> Položka</Button>
              </div>
              <div className="space-y-2">
                {form.line_items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-2">
                    <Input className="col-span-6" value={it.label} placeholder="Popis" onChange={(e) => updateItem(i, { label: e.target.value })} />
                    <Input className="col-span-3" type="number" value={it.bez_dph} onChange={(e) => updateItem(i, { bez_dph: Number(e.target.value) })} placeholder="Bez DPH" />
                    <Input className="col-span-2" type="number" value={it.dph_pct} onChange={(e) => updateItem(i, { dph_pct: Number(e.target.value) })} placeholder="DPH %" />
                    <Button type="button" variant="ghost" size="icon" className="col-span-1 text-rose-600" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col items-end gap-1 border-t pt-3 text-sm">
                <div>Bez DPH: <span className="ml-2 font-medium tabular-nums">{fmtKc(totals.bez)}</span></div>
                <div className="text-base font-semibold">Celkem s DPH: <span className="ml-2 tabular-nums">{fmtKc(totals.s)}</span></div>
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 font-semibold">Záloha &amp; poznámka</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Záloha (Kč)"><Input type="number" value={form.zaloha} onChange={(e) => setForm({ ...form, zaloha: Number(e.target.value) })} /></Field>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Poznámka</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </section>
          </div>

          {/* Right: actions & docs */}
          <aside className="space-y-4">
            {!isNew && (
              <>
                <section className="rounded-xl border bg-card p-4">
                  <h2 className="mb-3 font-semibold">Akce</h2>
                  <div className="space-y-2">
                    <div className="rounded-md border bg-muted/40 p-2 text-xs">
                      <div className="font-medium">Podpis prodejce</div>
                      {order?.seller_signed_at ? (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="truncate text-muted-foreground">
                            ✓ {order.seller_signer_name} · {new Date(order.seller_signed_at).toLocaleDateString("cs-CZ")}
                          </span>
                          <button onClick={onClearSellerSignature} className="text-rose-600 hover:underline" disabled={busy === "clear-seller"}>
                            odstranit
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setSellerOpen(true)} className="mt-1 text-primary hover:underline">
                          Přidat podpis prodejce
                        </button>
                      )}
                    </div>
                    <Button className="w-full justify-start" variant="outline" onClick={onGenerateOrder} disabled={busy === "gen-order"}>
                      {busy === "gen-order" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Vygenerovat PDF objednávky
                    </Button>
                    <Button className="w-full justify-start" variant="outline" onClick={onGenerateInvoice} disabled={busy === "gen-invoice"}>
                      {busy === "gen-invoice" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Vygenerovat zálohovou fakturu
                    </Button>
                    <Button className="w-full justify-start" variant="outline" onClick={() => setSignOpen(true)}>
                      <FileSignature className="mr-2 h-4 w-4" />
                      Podpis u prodejce
                    </Button>
                    <Button className="w-full justify-start" variant="outline" onClick={onSendSignLink} disabled={busy === "sign-remote"}>
                      {busy === "sign-remote" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                      Odeslat klientovi odkaz pro podpis
                    </Button>
                    <Button className="w-full justify-start" onClick={onSendDocs} disabled={busy === "send-docs"}>
                      {busy === "send-docs" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                      Odeslat dokumenty klientovi
                    </Button>
                  </div>
                </section>

                <section className="rounded-xl border bg-card p-4">
                  <h2 className="mb-3 font-semibold">Dokumenty</h2>
                  {docs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Žádné dokumenty zatím nejsou.</p>
                  ) : (
                    <ul className="space-y-1">
                      {docs.map((d: any) => (
                        <li key={d.id}>
                          <button onClick={() => onOpenDoc(d.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="flex-1 truncate">{KIND_LABEL[d.kind] || d.kind}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleDateString("cs-CZ")}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </aside>
        </div>
      </div>

      {/* In-person sign dialog */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Podpis klienta u prodejce</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Jméno podepisujícího"><Input value={signerName} onChange={(e) => setSignerName(e.target.value)} /></Field>
            <SignaturePad onChange={setSigData} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)}>Zrušit</Button>
            <Button onClick={onSignInPerson} disabled={busy === "sign-local"}>
              {busy === "sign-local" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Potvrdit podpis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seller signature dialog */}
      <Dialog open={sellerOpen} onOpenChange={setSellerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Podpis prodejce</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Jméno prodejce"><Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} /></Field>
            <SignaturePad onChange={setSellerSig} />
            <p className="text-xs text-muted-foreground">Podpis se automaticky vloží do PDF objednávky.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellerOpen(false)}>Zrušit</Button>
            <Button onClick={onSaveSellerSignature} disabled={busy === "sign-seller"}>
              {busy === "sign-seller" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Uložit podpis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New client dialog */}
      <Dialog open={clientOpen} onOpenChange={setClientOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nový klient</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Jméno"><Input value={newClient.full_name} onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })} /></Field>
            <Field label="Firma"><Input value={newClient.company} onChange={(e) => setNewClient({ ...newClient, company: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} /></Field>
            <Field label="Telefon"><Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></Field>
            <Field label="IČ"><Input value={newClient.ico} onChange={(e) => setNewClient({ ...newClient, ico: e.target.value })} /></Field>
            <Field label="DIČ"><Input value={newClient.dic} onChange={(e) => setNewClient({ ...newClient, dic: e.target.value })} /></Field>
            <div className="md:col-span-2">
              <Label className="text-xs">Adresa</Label>
              <Input value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientOpen(false)}>Zrušit</Button>
            <Button onClick={onCreateClient}>Vytvořit klienta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}