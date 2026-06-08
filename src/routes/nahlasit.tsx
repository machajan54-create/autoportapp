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

  const onFile = (cat: FileCategory, list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.size <= 8 * 1024 * 1024);
    if (arr.length < list.length) toast.error("Některé soubory přesahují 8 MB.");
    setFiles((f) => ({ ...f, [cat]: arr }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.phone) {
      toast.error("Vyplňte povinná pole.");
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
      <SiteHeader rightSlot={<Link to="/" className="hover:text-foreground">Přihlášení</Link>} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold text-foreground">Nahlášení pojistné události</h1>
        <p className="mt-2 text-sm text-muted-foreground">Pole označená * jsou povinná.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
                    onChange={(e) => onFile("accident", e.target.files)}
                  />
                  {files.accident.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {files.accident.length} souborů připraveno k odeslání
                    </p>
                  )}
                </div>
              )}
              <div className="sm:col-span-2">
                <Label>Doplňující informace</Label>
                <Textarea className="mt-1" rows={4} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>
          </section>

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
                    className="mt-1"
                    onChange={(e) => onFile(f.key, e.target.files)}
                  />
                  {files[f.key].length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {files[f.key].length} souborů
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Elektronický podpis *</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Podepište se prstem nebo myší. Podpis bude vložen do plných mocí.
            </p>
            <div className="mt-4">
              <SignaturePad onChange={setSignature} />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Po odeslání se automaticky vygenerují předvyplněné plné moci.
            </p>
          </section>

          <Button type="submit" size="lg" disabled={busy} className="w-full">
            {busy ? "Odesílám…" : "Odeslat pojistnou událost"}
          </Button>
        </form>
      </main>
    </div>
  );
}

const yesNo: [string, string][] = [["ano","Ano"],["ne","Ne"]];

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