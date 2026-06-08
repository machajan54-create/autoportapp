import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import {
  getVykup, upsertVykup, formatKc, marze,
  ZNACKY, ZDROJE, STAVY, type Vykup,
} from "@/lib/vykupy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vykupy/$id")({
  component: VykupForm,
});

type FormState = {
  znacka: string;
  model: string;
  rok_vyroby: string;
  pocet_km: string;
  klient: string;
  telefon: string;
  zdroj: string;
  zpracoval: string;
  naceneno_od: string;
  vykoupeno_za: string;
  prodano_za: string;
  naklady: string;
  datum_vykupu: string;
  stav: string;
  poznamka: string;
};

const empty: FormState = {
  znacka: "Citroen", model: "", rok_vyroby: "", pocet_km: "",
  klient: "", telefon: "", zdroj: "PRODEJ NOVÝCH VOZŮ", zpracoval: "",
  naceneno_od: "", vykoupeno_za: "", prodano_za: "", naklady: "0",
  datum_vykupu: new Date().toISOString().slice(0, 10),
  stav: "Nacenění", poznamka: "",
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
    klient: v.klient, telefon: v.telefon ?? "",
    zdroj: v.zdroj ?? "Jiné", zpracoval: v.zpracoval ?? "",
    naceneno_od: v.naceneno_od?.toString() ?? "",
    vykoupeno_za: v.vykoupeno_za?.toString() ?? "",
    prodano_za: v.prodano_za?.toString() ?? "",
    naklady: (v.naklady ?? 0).toString(),
    datum_vykupu: v.datum_vykupu ?? "",
    stav: v.stav, poznamka: v.poznamka ?? "",
  };
}

function VykupForm() {
  const { id } = useParams({ from: "/_authenticated/vykupy/$id" });
  const isNew = id === "novy";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["vykup", id],
    queryFn: () => getVykup(id),
    enabled: !isNew,
  });

  useEffect(() => {
    if (existing) setForm(fromVykup(existing));
  }, [existing]);

  const liveMarze = marze({
    prodano_za: toNum(form.prodano_za),
    vykoupeno_za: toNum(form.vykoupeno_za),
    naklady: toNum(form.naklady) ?? 0,
  });

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.klient.trim() || !form.model.trim()) {
      toast.error("Vyplňte alespoň klienta a model.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Vykup> = {
        znacka: form.znacka,
        model: form.model.trim(),
        rok_vyroby: toNum(form.rok_vyroby) ?? null,
        pocet_km: toNum(form.pocet_km) ?? null,
        klient: form.klient.trim(),
        telefon: form.telefon.trim() || null,
        zdroj: form.zdroj,
        zpracoval: form.zpracoval.trim() || null,
        naceneno_od: toNum(form.naceneno_od) ?? null,
        vykoupeno_za: toNum(form.vykoupeno_za) ?? null,
        prodano_za: toNum(form.prodano_za) ?? null,
        naklady: toNum(form.naklady) ?? 0,
        datum_vykupu: form.datum_vykupu || null,
        stav: form.stav,
        poznamka: form.poznamka.trim() || null,
      };
      if (!isNew) payload.id = id;
      await upsertVykup(payload);
      toast.success(isNew ? "Výkup vytvořen" : "Uloženo");
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
    <AdminShell>
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-10">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/vykupy" })} className="mb-3 -ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Zpět
        </Button>
        <h1 className="text-2xl font-bold md:text-3xl">
          {isNew ? "Nový výkup" : "Upravit výkup"}
        </h1>

        <form onSubmit={onSave} className="mt-6 space-y-6 rounded-xl border bg-card p-5">
          <Section title="Vozidlo">
            <Field label="Značka">
              <Select value={form.znacka} onValueChange={(v) => set("znacka", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ZNACKY.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Model">
              <Input value={form.model} onChange={(e) => set("model", e.target.value)} required />
            </Field>
            <Field label="Rok výroby">
              <Input type="number" value={form.rok_vyroby} onChange={(e) => set("rok_vyroby", e.target.value)} />
            </Field>
            <Field label="Počet km">
              <Input type="number" value={form.pocet_km} onChange={(e) => set("pocet_km", e.target.value)} />
            </Field>
          </Section>

          <Section title="Klient">
            <Field label="Klient">
              <Input value={form.klient} onChange={(e) => set("klient", e.target.value)} required />
            </Field>
            <Field label="Telefon">
              <Input value={form.telefon} onChange={(e) => set("telefon", e.target.value)} />
            </Field>
            <Field label="Zdroj">
              <Select value={form.zdroj} onValueChange={(v) => set("zdroj", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ZDROJE.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Zpracoval">
              <Input value={form.zpracoval} onChange={(e) => set("zpracoval", e.target.value)} />
            </Field>
          </Section>

          <Section title="Cenová kalkulace">
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
          </Section>

          <Section title="Stav">
            <Field label="Datum výkupu">
              <Input type="date" value={form.datum_vykupu} onChange={(e) => set("datum_vykupu", e.target.value)} />
            </Field>
            <Field label="Stav">
              <Select value={form.stav} onValueChange={(v) => set("stav", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAVY.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Poznámka</Label>
              <Textarea rows={3} value={form.poznamka} onChange={(e) => set("poznamka", e.target.value)} />
            </div>
          </Section>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/vykupy" })}>
              Zrušit
            </Button>
            <Button type="submit" disabled={saving} className="bg-orange-500 text-white hover:bg-orange-600">
              {saving ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
        </form>
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