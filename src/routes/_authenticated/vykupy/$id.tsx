import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { RequestDeleteButton } from "@/components/RequestDeleteButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, FileText, Loader2, Upload, AlertTriangle, Trash2, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getVykup, upsertVykup, formatKc, marze,
  ZNACKY, ZDROJE, STAVY, type Vykup,
} from "@/lib/vykupy";
import { listEmployees, getMyAccess } from "@/lib/claims.functions";
import { listClients } from "@/lib/clients.functions";
import {
  listVykupPhotos, recordVykupPhoto, updateVykupPhotoDefect,
  deleteVykupPhoto, getVykupPhotoUrl,
} from "@/lib/vykup-photos.functions";
import { generateVykupContract } from "@/lib/vykup-contract.functions";
import { resizeImage } from "@/lib/resize-image";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vykupy/$id")({
  component: VykupForm,
});

type FormState = {
  znacka: string;
  model: string;
  rok_vyroby: string;
  pocet_km: string;
  barva: string;
  new_in_cz: "" | "yes" | "no";
  service_history: "" | "yes" | "no";
  klient: string;
  telefon: string;
  zdroj: string;
  zpracoval: string;
  naceneno_od: string;
  owner_expectation_czk: string;
  vykoupeno_za: string;
  prodano_za: string;
  naklady: string;
  naklady_popis: string;
  datum_vykupu: string;
  stav: string;
  poznamka: string;
  follow_up_at: string;
  internal_priced_by_user_id: string;
  internal_priced_amount: string;
  internal_priced_at: string;
  external_priced_by: string;
  external_priced_amount: string;
  external_priced_at: string;
};

const empty: FormState = {
  znacka: "Citroën", model: "", rok_vyroby: "", pocet_km: "",
  barva: "", new_in_cz: "", service_history: "",
  klient: "", telefon: "", zdroj: "", zpracoval: "",
  naceneno_od: "", owner_expectation_czk: "",
  vykoupeno_za: "", prodano_za: "", naklady: "0", naklady_popis: "",
  datum_vykupu: "",
  stav: "Nacenění", poznamka: "",
  follow_up_at: "",
  internal_priced_by_user_id: "", internal_priced_amount: "", internal_priced_at: "",
  external_priced_by: "", external_priced_amount: "", external_priced_at: "",
};

function toNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fromVykup(v: Vykup): FormState {
  return {
    znacka: v.znacka, model: v.model,
    rok_vyroby: v.rok_vyroby?.toString() ?? "",
    pocet_km: v.pocet_km?.toString() ?? "",
    barva: v.barva ?? "",
    new_in_cz: v.new_in_cz === true ? "yes" : v.new_in_cz === false ? "no" : "",
    service_history: v.service_history === true ? "yes" : v.service_history === false ? "no" : "",
    klient: v.klient, telefon: v.telefon ?? "",
    zdroj: v.zdroj ?? "Jiné", zpracoval: v.zpracoval ?? "",
    naceneno_od: v.naceneno_od?.toString() ?? "",
    owner_expectation_czk: v.owner_expectation_czk?.toString() ?? "",
    vykoupeno_za: v.vykoupeno_za?.toString() ?? "",
    prodano_za: v.prodano_za?.toString() ?? "",
    naklady: (v.naklady ?? 0).toString(),
    naklady_popis: v.naklady_popis ?? "",
    datum_vykupu: v.datum_vykupu ?? "",
    stav: v.stav, poznamka: v.poznamka ?? "",
    follow_up_at: v.follow_up_at ? v.follow_up_at.slice(0, 16) : "",
    internal_priced_by_user_id: v.internal_priced_by_user_id ?? "",
    internal_priced_amount: v.internal_priced_amount?.toString() ?? "",
    internal_priced_at: v.internal_priced_at ? v.internal_priced_at.slice(0, 10) : "",
    external_priced_by: v.external_priced_by ?? "",
    external_priced_amount: v.external_priced_amount?.toString() ?? "",
    external_priced_at: v.external_priced_at ? v.external_priced_at.slice(0, 10) : "",
  };
}

function VykupForm() {
  const { id } = useParams({ from: "/_authenticated/vykupy/$id" });
  const isNew = id === "novy";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const skipAutoSaveRef = useRef(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchEmployees = useServerFn(listEmployees);
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => fetchEmployees({}),
  });
  const fetchAccess = useServerFn(getMyAccess);
  const { data: access } = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess({}),
  });
  const modules = (access?.modules ?? []) as string[];
  const isAdmin = !!access?.isAdmin;
  const canFull = isAdmin || modules.includes("vykupy");
  const canExternalOnly = !canFull && modules.includes("vykupy_external");
  const ro = canExternalOnly; // read-only mode for everything except externí nacenění

  const { data: existing } = useQuery({
    queryKey: ["vykup", id],
    queryFn: () => getVykup(id),
    enabled: !isNew,
  });

  useEffect(() => {
    if (existing) {
      skipAutoSaveRef.current = true;
      setForm(fromVykup(existing));
    }
  }, [existing]);

  const liveMarze = marze({
    prodano_za: toNum(form.prodano_za),
    vykoupeno_za: toNum(form.vykoupeno_za),
    naklady: toNum(form.naklady) ?? 0,
  });

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function buildPayload(): Partial<Vykup> {
    const fullPayload: Partial<Vykup> = {
      znacka: form.znacka,
      model: form.model.trim(),
      rok_vyroby: toNum(form.rok_vyroby) ?? null,
      pocet_km: toNum(form.pocet_km) ?? null,
      barva: form.barva.trim() || null,
      new_in_cz: form.new_in_cz === "" ? null : form.new_in_cz === "yes",
      service_history: form.service_history === "" ? null : form.service_history === "yes",
      klient: form.klient.trim(),
      telefon: form.telefon.trim() || null,
      zdroj: form.zdroj,
      zpracoval: form.zpracoval.trim() || null,
      naceneno_od: toNum(form.naceneno_od) ?? null,
      owner_expectation_czk: toNum(form.owner_expectation_czk) ?? null,
      vykoupeno_za: toNum(form.vykoupeno_za) ?? null,
      prodano_za: toNum(form.prodano_za) ?? null,
      naklady: toNum(form.naklady) ?? 0,
      naklady_popis: form.naklady_popis.trim() || null,
      datum_vykupu: form.datum_vykupu || null,
      stav: form.stav,
      poznamka: form.poznamka.trim() || null,
      follow_up_at: form.follow_up_at ? new Date(form.follow_up_at).toISOString() : null,
      follow_up_notified_at: null,
      internal_priced_by_user_id: form.internal_priced_by_user_id || null,
      internal_priced_amount: toNum(form.internal_priced_amount) ?? null,
      internal_priced_at: form.internal_priced_at || null,
      external_priced_by: form.external_priced_by.trim() || null,
      external_priced_amount: toNum(form.external_priced_amount) ?? null,
      external_priced_at: form.external_priced_at || null,
    };
    const extOnlyPayload: Partial<Vykup> = {
      external_priced_by: form.external_priced_by.trim() || null,
      external_priced_amount: toNum(form.external_priced_amount) ?? null,
      external_priced_at: form.external_priced_at || null,
    };
    return canFull ? fullPayload : extOnlyPayload;
  }

  // Automatické ukládání (debounce 1,5 s) – jen pro existující záznamy.
  useEffect(() => {
    if (isNew) return;
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }
    if (saving) return;
    if (canFull && (!form.klient.trim() || !form.model.trim())) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaving(true);
      try {
        const payload = buildPayload();
        payload.id = id;
        await upsertVykup(payload);
        setLastSavedAt(new Date());
        qc.invalidateQueries({ queryKey: ["vykupy"] });
      } catch {
        toast.error("Automatické uložení selhalo");
      } finally {
        setAutoSaving(false);
      }
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isNew, canFull, id]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (canFull && (!form.klient.trim() || !form.model.trim())) {
      toast.error("Vyplňte alespoň klienta a model.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (!isNew) payload.id = id;
      if (isNew && !canFull) {
        toast.error("Nemáte oprávnění vytvořit nový výkup.");
        setSaving(false);
        return;
      }
      await upsertVykup(payload);
      toast.success(isNew ? "Výkup vytvořen" : "Uloženo");
      setLastSavedAt(new Date());
      qc.invalidateQueries({ queryKey: ["vykupy"] });
      qc.invalidateQueries({ queryKey: ["vykup", id] });
      navigate({ to: "/vykupy" });
    } catch (err) {
      toast.error("Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell requireModule={["vykupy", "vykupy_external"]}>
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-10">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/vykupy" })} className="mb-3 -ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Zpět
        </Button>
        <h1 className="text-2xl font-bold md:text-3xl">
          {isNew ? "Nový výkup" : canExternalOnly ? "Externí nacenění" : "Upravit výkup"}
        </h1>
        {canExternalOnly && (
          <p className="mt-2 text-sm text-muted-foreground">
            Máte přístup pouze k vyplnění externího nacenění. Ostatní pole jsou pouze pro čtení.
          </p>
        )}

        <form onSubmit={onSave} className="mt-6 space-y-6 rounded-xl border bg-card p-5">
          <Section title="Vozidlo">
            <Field label="Značka">
              <Select value={form.znacka} onValueChange={(v) => set("znacka", v)} disabled={ro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ZNACKY.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Model">
              <Input value={form.model} onChange={(e) => set("model", e.target.value)} required={!ro} readOnly={ro} />
            </Field>
            <Field label="Rok výroby">
              <Input type="number" value={form.rok_vyroby} onChange={(e) => set("rok_vyroby", e.target.value)} readOnly={ro} />
            </Field>
            <Field label="Počet km">
              <Input type="number" value={form.pocet_km} onChange={(e) => set("pocet_km", e.target.value)} readOnly={ro} />
            </Field>
            <Field label="Barva">
              <Input value={form.barva} onChange={(e) => set("barva", e.target.value)} readOnly={ro} placeholder="např. černá metalíza" />
            </Field>
            <Field label="Nové v ČR">
              <Select value={form.new_in_cz || "unknown"} onValueChange={(v) => set("new_in_cz", v === "unknown" ? "" : (v as "yes" | "no"))} disabled={ro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">— neuvedeno —</SelectItem>
                  <SelectItem value="yes">Ano</SelectItem>
                  <SelectItem value="no">Ne</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Servisní historie">
              <Select value={form.service_history || "unknown"} onValueChange={(v) => set("service_history", v === "unknown" ? "" : (v as "yes" | "no"))} disabled={ro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">— neuvedeno —</SelectItem>
                  <SelectItem value="yes">Ano</SelectItem>
                  <SelectItem value="no">Ne</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section title="Klient">
            <Field label="Klient">
              <Input value={form.klient} onChange={(e) => set("klient", e.target.value)} required={!ro} readOnly={ro} />
            </Field>
            <Field label="Telefon">
              <Input value={form.telefon} onChange={(e) => set("telefon", e.target.value)} readOnly={ro} />
            </Field>
            <Field label="Zdroj">
              <Select value={form.zdroj} onValueChange={(v) => set("zdroj", v)} disabled={ro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ZDROJE.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Zpracoval">
              <Input value={form.zpracoval} onChange={(e) => set("zpracoval", e.target.value)} readOnly={ro} />
            </Field>
          </Section>

          {canFull && <Section title="Cenová kalkulace">
            <Field label="Představa majitele (Kč)">
              <Input type="number" value={form.owner_expectation_czk} onChange={(e) => set("owner_expectation_czk", e.target.value)} />
            </Field>
            <Field label="Naceněno od (Kč)">
              <Input type="number" value={form.naceneno_od} onChange={(e) => set("naceneno_od", e.target.value)} />
            </Field>
            <Field label="Vykoupeno za (Kč)">
              <Input type="number" value={form.vykoupeno_za} onChange={(e) => set("vykoupeno_za", e.target.value)} />
            </Field>
            <Field label="Prodáno za (Kč)">
              <Input type="number" value={form.prodano_za} onChange={(e) => set("prodano_za", e.target.value)} />
            </Field>
            <Field label="Náklady (Kč)">
              <Input type="number" value={form.naklady} onChange={(e) => set("naklady", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Náklady – popis (myčka, oprava, příprava…)</Label>
              <Textarea rows={2} value={form.naklady_popis} onChange={(e) => set("naklady_popis", e.target.value)} placeholder="např. Myčka 500, oprava nárazníku 3 200, příprava 1 000" />
            </div>
            <div className="sm:col-span-2">
              <div className={cn(
                "rounded-lg border p-3 text-sm",
                liveMarze == null && "bg-muted text-muted-foreground",
                liveMarze != null && liveMarze >= 0 && "border-emerald-200 bg-emerald-50 text-emerald-900",
                liveMarze != null && liveMarze < 0 && "border-rose-200 bg-rose-50 text-rose-900",
              )}>
                <span className="font-medium">Marže: </span>
                <span className="tabular-nums font-bold">{liveMarze == null ? "vyplňte prodáno a vykoupeno" : formatKc(liveMarze)}</span>
              </div>
            </div>
          </Section>}

          {canFull && <Section title="Nacenění – interní">
            <Field label="Kdo nacenil (zaměstnanec)">
              <Select
                value={form.internal_priced_by_user_id || "none"}
                onValueChange={(v) => set("internal_priced_by_user_id", v === "none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Vyberte…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— nezadáno —</SelectItem>
                  {(employees ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Interní nacenění (Kč)">
              <Input type="number" value={form.internal_priced_amount} onChange={(e) => set("internal_priced_amount", e.target.value)} />
            </Field>
            <Field label="Datum interního nacenění">
              <Input type="date" value={form.internal_priced_at} onChange={(e) => set("internal_priced_at", e.target.value)} />
            </Field>
          </Section>}

          <Section title="Nacenění – externí">
            <Field label="Kdo nacenil (firma / jméno)">
              <Input value={form.external_priced_by} onChange={(e) => set("external_priced_by", e.target.value)} placeholder="např. AAA Auto" />
            </Field>
            <Field label="Externí nacenění (Kč)">
              <Input type="number" value={form.external_priced_amount} onChange={(e) => set("external_priced_amount", e.target.value)} />
            </Field>
            <Field label="Datum externího nacenění">
              <Input type="date" value={form.external_priced_at} onChange={(e) => set("external_priced_at", e.target.value)} />
            </Field>
          </Section>

          {canFull && <Section title="Stav">
            <Field label="Datum výkupu">
              <Input type="date" value={form.datum_vykupu} onChange={(e) => set("datum_vykupu", e.target.value)} />
            </Field>
            <Field label="Stav">
              <Select value={form.stav} onValueChange={(v) => set("stav", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAVY.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Follow-up (připomínka e-mailem)">
              <Input
                type="datetime-local"
                value={form.follow_up_at}
                onChange={(e) => set("follow_up_at", e.target.value)}
              />
            </Field>
            {existing?.stav_changed_at && (
              <Field label="Ve stavu od">
                <Input
                  readOnly
                  value={`${new Date(existing.stav_changed_at).toLocaleDateString("cs-CZ")} (${daysSince(existing.stav_changed_at)} dní)`}
                />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Poznámka</Label>
              <Textarea rows={3} value={form.poznamka} onChange={(e) => set("poznamka", e.target.value)} />
            </div>
          </Section>}

          <div className="flex justify-end gap-2">
            {!isNew && (
              <div className="mr-auto flex items-center text-xs text-muted-foreground">
                {autoSaving
                  ? "Automaticky ukládám…"
                  : lastSavedAt
                    ? `Automaticky uloženo v ${lastSavedAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`
                    : "Změny se ukládají automaticky"}
              </div>
            )}
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/vykupy" })}>
              Zrušit
            </Button>
            {!isNew && canFull && <ContractPdfButton vykupId={id} />}
            <Button type="submit" disabled={saving} className="bg-orange-500 text-white hover:bg-orange-600">
              {saving ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
        </form>

        {!isNew && canFull && <PhotoGallery vykupId={id} />}
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {children}
    </div>
  );
}

function daysSince(iso: string): number {
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
}

function ContractPdfButton({ vykupId }: { vykupId: string }) {
  const generate = useServerFn(generateVykupContract);
  const [busy, setBusy] = useState(false);
  async function handle() {
    setBusy(true);
    try {
      const { base64, file_name } = await generate({ data: { vykupId } });
      const bin = atob(base64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const blob = new Blob([buf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file_name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se vygenerovat PDF");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button type="button" variant="outline" onClick={handle} disabled={busy}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
      Smlouva (PDF)
    </Button>
  );
}

function PhotoGallery({ vykupId }: { vykupId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listVykupPhotos);
  const record = useServerFn(recordVykupPhoto);
  const del = useServerFn(deleteVykupPhoto);
  const setDefect = useServerFn(updateVykupPhotoDefect);
  const getUrl = useServerFn(getVykupPhotoUrl);

  const { data } = useQuery({
    queryKey: ["vykup-photos", vykupId],
    queryFn: () => list({ data: { vykupId } }),
  });

  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = data?.rows ?? [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const p of rows) {
        if (thumbs[p.id]) continue;
        try {
          const { url } = await getUrl({ data: { id: p.id } });
          if (!cancelled) setThumbs((t) => ({ ...t, [p.id]: url }));
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.id).join(",")]);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    try {
      for (const file of arr) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: pouze obrázky`);
          continue;
        }
        const resized = await resizeImage(file, { maxWidth: 1920, maxHeight: 1920 });
        if (resized.size > 20 * 1024 * 1024) {
          toast.error(`${resized.name}: max 20 MB`);
          continue;
        }
        const ext = resized.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${vykupId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("vykup-photos")
          .upload(path, resized, { contentType: resized.type });
        if (upErr) {
          toast.error(`${resized.name}: ${upErr.message}`);
          continue;
        }
        await record({
          data: {
            vykupId,
            file_name: resized.name,
            storage_path: path,
            size_bytes: resized.size,
            content_type: resized.type,
          },
        });
      }
      qc.invalidateQueries({ queryKey: ["vykup-photos", vykupId] });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Smazat fotografii?")) return;
    try {
      await del({ data: { id } });
      setThumbs((t) => {
        const n = { ...t };
        delete n[id];
        return n;
      });
      qc.invalidateQueries({ queryKey: ["vykup-photos", vykupId] });
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se smazat");
    }
  }

  async function toggleDefect(p: any) {
    try {
      await setDefect({
        data: { id: p.id, has_defect: !p.has_defect, defect_note: p.defect_note ?? null },
      });
      qc.invalidateQueries({ queryKey: ["vykup-photos", vykupId] });
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se uložit");
    }
  }

  async function updateNote(p: any, note: string) {
    try {
      await setDefect({
        data: { id: p.id, has_defect: p.has_defect, defect_note: note || null },
      });
      qc.invalidateQueries({ queryKey: ["vykup-photos", vykupId] });
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se uložit");
    }
  }

  return (
    <section className="mt-6 space-y-3 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Fotogalerie vozu ({rows.length})
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Nahrát fotky
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground transition-colors",
          dragOver ? "border-orange-400 bg-orange-50" : "border-muted-foreground/20",
        )}
      >
        Přetáhněte fotografie sem nebo klikněte na „Nahrát fotky". Max 20 MB / soubor.
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {rows.map((p: any) => (
            <div
              key={p.id}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-muted",
                p.has_defect && "ring-2 ring-rose-400",
              )}
            >
              <div className="aspect-square w-full bg-muted">
                {thumbs[p.id] ? (
                  <img
                    src={thumbs[p.id]}
                    alt={p.file_name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Načítám…
                  </div>
                )}
              </div>
              {p.has_defect && (
                <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  <AlertTriangle className="h-3 w-3" /> VADA
                </div>
              )}
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {thumbs[p.id] && (
                  <a
                    href={thumbs[p.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </a>
                )}
                <RequestDeleteButton
                  entityType="vykup_photos"
                  entityId={p.id}
                  entityLabel={`Fotka: ${p.file_name ?? ""}`}
                  size="icon"
                  className="h-6 w-6 rounded bg-black/60 p-1 text-white hover:bg-rose-600"
                  title="Požádat o smazání fotky"
                />
              </div>
              <div className="space-y-1 p-2 text-xs">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={p.has_defect}
                    onChange={() => toggleDefect(p)}
                  />
                  <span>Označit jako vadu</span>
                </label>
                {p.has_defect && (
                  <Input
                    className="h-7 text-xs"
                    placeholder="Popis vady"
                    defaultValue={p.defect_note ?? ""}
                    onBlur={(e) => {
                      if ((e.target.value || "") !== (p.defect_note ?? ""))
                        updateNote(p, e.target.value);
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}