import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createClaim } from "@/lib/claims.functions";
import { Phone, X, FileText, Check } from "lucide-react";

export const Route = createFileRoute("/nahlasit")({
  head: () => ({
    meta: [{ title: "Nahlášení pojistné události" }],
  }),
  component: Page,
});

type FileCategory = "tp" | "rp" | "accident" | "damage" | "photos";
const fileFields: { key: FileCategory; label: string; multiple?: boolean }[] = [
  { key: "tp", label: "Technický průkaz" },
  { key: "rp", label: "Řidičský průkaz" },
  { key: "damage", label: "Záznam o poškození vozu" },
  { key: "photos", label: "Fotodokumentace", multiple: true },
];

const INSURERS = [
  "Allianz pojišťovna",
  "ČSOB Pojišťovna",
  "Česká podnikatelská pojišťovna",
  "Direct pojišťovna",
  "ERGO pojišťovna",
  "Generali Česká pojišťovna",
  "Hasičská vzájemná pojišťovna",
  "Kooperativa pojišťovna",
  "Pillow pojišťovna",
  "Slavia pojišťovna",
  "UNIQA pojišťovna",
];

function Page() {
  const navigate = useNavigate();
  const submit = useServerFn(createClaim);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<Record<FileCategory, File[]>>({
    tp: [], rp: [], accident: [], damage: [], photos: [],
  });
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [insurerChoice, setInsurerChoice] = useState<string>("");
  const [step, setStep] = useState(0);
  const steps = ["Kontakt", "Událost", "Přílohy", "Podpis"];

  const onFile = (cat: FileCategory, list: FileList | null, multiple = false) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.size <= 8 * 1024 * 1024);
    if (arr.length < list.length) toast.error("Některé soubory přesahují 8 MB.");
    setFiles((f) => ({ ...f, [cat]: multiple ? [...f[cat], ...arr] : arr }));
  };
  const removeFile = (cat: FileCategory, idx: number) =>
    setFiles((f) => ({ ...f, [cat]: f[cat].filter((_, i) => i !== idx) }));

  function validateStep(): boolean {
    if (step === 0) {
      if (!form.first_name || !form.last_name || !form.phone) {
        toast.error("Vyplňte jméno, příjmení a telefon.");
        return false;
      }
    }
    if (step === 3 && !signature) {
      toast.error("Doplňte podpis.");
      return false;
    }
    return true;
  }
  const next = () => { if (validateStep()) setStep((s) => Math.min(s + 1, steps.length - 1)); };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== steps.length - 1) { next(); return; }
    if (!form.first_name || !form.last_name || !form.phone) {
      toast.error("Vyplňte povinná pole.");
      setStep(0);
      return;
    }
    if (!signature) {
      toast.error("Doplňte podpis.");
      return;
    }
    setBusy(true);
    try {
      const finalInsurer =
        insurerChoice === "__other__" ? form.insurer_other?.trim() || null : insurerChoice || null;
      const tempId = crypto.randomUUID();
      const uploaded: { category: string; file_path: string; file_name: string; mime_type?: string; size?: number }[] = [];
      for (const cat of Object.keys(files) as FileCategory[]) {
        for (const file of files[cat]) {
          const path = `${tempId}/${cat}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
          const { error } = await supabase.storage.from("claim-files").upload(path, file, {
            upsert: false, contentType: file.type,
          });
          if (error) throw error;
          uploaded.push({ category: cat, file_path: path, file_name: file.name, mime_type: file.type, size: file.size });
        }
      }
      await submit({
        data: {
          first_name: form.first_name,
          last_name: form.last_name,
          company: form.company || null,
          ico: form.ico || null,
          address: form.address || null,
          phone: form.phone,
          email: form.email || "",
          insurer: finalInsurer,
          claim_number: form.claim_number || null,
          event_at: form.event_at || null,
          location: form.location || null,
          liquidation_type: form.liquidation_type || null,
          vat_payer: form.vat_payer || null,
          loan_lease: form.loan_lease || null,
          accident_record: form.accident_record || null,
          insurer_record: form.insurer_record || null,
          notes: form.notes || null,
          signature,
          attachments: uploaded,
        },
      });
      toast.success("Pojistná událost byla odeslána.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        rightSlot={
          <div className="flex items-center gap-3 text-sm">
            <a
              href="tel:+420800100200"
              className="hidden sm:inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
            >
              <Phone className="h-3.5 w-3.5" /> +420 800 100 200
            </a>
            <Link to="/" className="hover:text-foreground">Přihlášení</Link>
          </div>
        }
      />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold text-foreground">Nahlášení pojistné události</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pole označená * jsou povinná. Potřebujete pomoc?{" "}
          <a href="tel:+420800100200" className="font-medium text-primary underline">
            Zavolejte +420 800 100 200
          </a>.
        </p>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-medium">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                    i < step
                      ? "border-primary bg-primary text-primary-foreground"
                      : i === step
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={i === step ? "text-foreground" : "text-muted-foreground"}>
                  {s}
                </span>
                {i < steps.length - 1 && (
                  <div className={`mx-2 hidden h-px flex-1 sm:block ${i < step ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {step === 0 && (
          <section className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Kontaktní údaje</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Jméno *" k="first_name" set={set} />
              <Field label="Příjmení *" k="last_name" set={set} />
              <Field label="Společnost" k="company" set={set} />
              <Field label="IČ" k="ico" set={set} />
              <Field label="Adresa" k="address" set={set} className="sm:col-span-2" />
              <Field label="Telefon *" k="phone" set={set} />
              <Field label="E-mail" k="email" set={set} type="email" />
            </div>
          </section>
          )}

          {step === 1 && (
          <section className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Pojistná událost</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Pojišťovna</Label>
                <Select value={insurerChoice} onValueChange={setInsurerChoice}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Vyberte pojišťovnu" />
                  </SelectTrigger>
                  <SelectContent>
                    {INSURERS.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                    <SelectItem value="__other__">Jiná…</SelectItem>
                  </SelectContent>
                </Select>
                {insurerChoice === "__other__" && (
                  <Input
                    className="mt-2"
                    placeholder="Zadejte název pojišťovny"
                    onChange={(e) => set("insurer_other", e.target.value)}
                  />
                )}
              </div>
              <Field label="Číslo škody" k="claim_number" set={set} />
              <Field label="Datum a čas události" k="event_at" set={set} type="datetime-local" />
              <Field label="Místo události" k="location" set={set} />
              <SelectField label="Způsob likvidace" k="liquidation_type" set={set}
                options={[["havarijni","Havarijní pojištění"],["povinne_ruceni","Povinné ručení"]]} />
              <SelectField label="Plátce DPH" k="vat_payer" set={set} options={yesNo} />
              <SelectField label="Vozidlo na úvěr/leasing" k="loan_lease" set={set} options={yesNo} />
              <SelectField label="Záznam o dopravní nehodě" k="accident_record" set={set} options={yesNo} />
              <SelectField label="Záznam o poškození pojišťovnou" k="insurer_record" set={set} options={yesNo} />
              {form.accident_record === "ano" && (
                <div className="sm:col-span-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                  <Label>Soubor / fotografie záznamu o dopravní nehodě</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nahrajte sken nebo vyfoťte mobilem (max. 8 MB / soubor).
                  </p>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    capture="environment"
                    className="mt-2"
                    onChange={(e) => onFile("accident", e.target.files, true)}
                  />
                  <FilePreview list={files.accident} onRemove={(i) => removeFile("accident", i)} />
                </div>
              )}
              <div className="sm:col-span-2">
                <Label>Doplňující informace</Label>
                <Textarea className="mt-1" rows={4} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>
          </section>
          )}

          {step === 2 && (
          <section className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Přílohy</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Maximální velikost souboru 8 MB. U dokladů dbejte na čitelnost.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {fileFields.map((f) => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input
                    type="file"
                    multiple={f.multiple}
                    accept="image/*,application/pdf"
                    className="mt-1"
                    onChange={(e) => onFile(f.key, e.target.files, !!f.multiple)}
                  />
                  <FilePreview list={files[f.key]} onRemove={(i) => removeFile(f.key, i)} />
                </div>
              ))}
            </div>
          </section>
          )}

          {step === 3 && (
          <section className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Elektronický podpis *</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong>Podepište se v poli níže</strong> — prstem na mobilu nebo myší na počítači.
              Podpis bude vložen do plných mocí.
            </p>
            <div className="mt-4">
              <SignaturePad onChange={setSignature} />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Po odeslání se automaticky vygenerují předvyplněné plné moci.
            </p>
          </section>
          )}

          <div className="flex gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" size="lg" onClick={prev} disabled={busy}>
                Zpět
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button type="button" size="lg" className="flex-1" onClick={next}>
                Pokračovat
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={busy} className="flex-1">
                {busy ? "Odesílám…" : "Odeslat pojistnou událost"}
              </Button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}

const yesNo: [string, string][] = [["ano","Ano"],["ne","Ne"]];

function FilePreview({ list, onRemove }: { list: File[]; onRemove: (i: number) => void }) {
  if (!list.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {list.map((f, i) => {
        const isImg = f.type.startsWith("image/");
        const url = isImg ? URL.createObjectURL(f) : null;
        return (
          <li
            key={i}
            className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
          >
            {url ? (
              <img src={url} alt={f.name} className="h-10 w-10 rounded object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate">{f.name}</p>
              <p className="text-muted-foreground">{(f.size / 1024).toFixed(0)} kB</p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
              aria-label="Odstranit"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Field({ label, k, set, type = "text", className }: {
  label: string; k: string; set: (k: string, v: string) => void; type?: string; className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <Input type={type} className="mt-1" onChange={(e) => set(k, e.target.value)} />
    </div>
  );
}

function SelectField({ label, k, set, options }: {
  label: string; k: string; set: (k: string, v: string) => void; options: [string, string][];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select onValueChange={(v) => set(k, v)}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Nevybráno" /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}