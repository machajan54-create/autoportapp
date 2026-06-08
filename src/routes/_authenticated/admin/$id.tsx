import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getClaim, updateClaimStatus, generatePoaPdf } from "@/lib/claims.functions";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$id")({
  component: ClaimDetail,
});

function ClaimDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetch = useServerFn(getClaim);
  const update = useServerFn(updateClaimStatus);
  const genPoa = useServerFn(generatePoaPdf);

  const { data, isLoading } = useQuery({
    queryKey: ["claim", id],
    queryFn: () => fetch({ data: { id } }),
  });

  async function setStatus(s: "new" | "in_progress" | "closed") {
    await update({ data: { id, status: s } });
    qc.invalidateQueries({ queryKey: ["claim", id] });
    qc.invalidateQueries({ queryKey: ["claims"] });
    toast.success("Stav aktualizován");
  }

  async function downloadPoa(kind: "jednani" | "plneni") {
    const r = await genPoa({ data: { id, kind } });
    const bin = atob(r.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `plna-moc-${kind}-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading || !data) return <div className="p-10 text-muted-foreground">Načítám…</div>;
  const c = data.claim;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader rightSlot={
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />Zpět
        </Button>
      } />
      <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{c.first_name} {c.last_name}</h1>
            <p className="text-sm text-muted-foreground">
              Přijato {new Date(c.created_at).toLocaleString("cs-CZ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={c.status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Nová</SelectItem>
                <SelectItem value="in_progress">V řešení</SelectItem>
                <SelectItem value="closed">Uzavřeno</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Section title="Kontakt">
          <Row label="Jméno" v={`${c.first_name} ${c.last_name}`} />
          <Row label="Telefon" v={c.phone} />
          <Row label="E-mail" v={c.email} />
          <Row label="Společnost" v={c.company} />
          <Row label="IČ" v={c.ico} />
          <Row label="Adresa" v={c.address} />
        </Section>

        <Section title="Událost">
          <Row label="Pojišťovna" v={c.insurer} />
          <Row label="Číslo škody" v={c.claim_number} />
          <Row label="Datum" v={c.event_at ? new Date(c.event_at).toLocaleString("cs-CZ") : null} />
          <Row label="Místo" v={c.location} />
          <Row label="Způsob likvidace" v={c.liquidation_type} />
          <Row label="Plátce DPH" v={c.vat_payer} />
          <Row label="Úvěr/leasing" v={c.loan_lease} />
          <Row label="Záznam o nehodě" v={c.accident_record} />
          <Row label="Záznam pojišťovnou" v={c.insurer_record} />
          {c.notes && <div className="col-span-2"><div className="text-xs text-muted-foreground">Poznámka</div><div>{c.notes}</div></div>}
        </Section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Přílohy</h2>
          {data.attachments.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Žádné přílohy</p>}
          <ul className="mt-3 space-y-2 text-sm">
            {data.attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                <span>
                  <span className="font-medium">[{a.category}]</span> {a.file_name}
                </span>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-primary underline">
                    Otevřít
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Podpis</h2>
          {c.signature && <img src={c.signature} alt="podpis" className="mt-3 max-h-32 border rounded" />}
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Plné moci</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => downloadPoa("jednani")}>
              <FileText className="mr-2 h-4 w-4" />Plná moc k jednání
            </Button>
            <Button variant="outline" onClick={() => downloadPoa("plneni")}>
              <Download className="mr-2 h-4 w-4" />Plná moc k převzetí plnění
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="font-semibold">{title}</h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}
function Row({ label, v }: { label: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{v}</dd>
    </div>
  );
}