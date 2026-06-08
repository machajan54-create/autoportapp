import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getClaim,
  updateClaimStatus,
  generatePoaPdf,
  setVatPaid,
  addTask,
  toggleTask,
  deleteTask,
  notifyClient,
} from "@/lib/claims.functions";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileText,
  Image as ImageIcon,
  QrCode,
  Trash2,
  Mail,
  Printer,
  Copy,
  ExternalLink,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";

export const Route = createFileRoute("/_authenticated/admin/$id")({
  component: ClaimDetail,
});

const statusOptions: { value: string; label: string; cls: string }[] = [
  { value: "new", label: "Nová", cls: "bg-primary/10 text-primary border-primary/20" },
  { value: "in_repair", label: "V opravě", cls: "bg-amber-100 text-amber-900 border-amber-200" },
  { value: "waiting_vat", label: "Čeká na DPH", cls: "bg-violet-100 text-violet-900 border-violet-200" },
  { value: "done", label: "Dokončeno", cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
];

function statusMeta(s: string) {
  if (s === "in_progress") return statusOptions[1];
  if (s === "closed") return statusOptions[3];
  return statusOptions.find((o) => o.value === s) ?? statusOptions[0];
}

function ClaimDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetch = useServerFn(getClaim);
  const update = useServerFn(updateClaimStatus);
  const genPoa = useServerFn(generatePoaPdf);
  const setVat = useServerFn(setVatPaid);
  const addTaskFn = useServerFn(addTask);
  const toggleFn = useServerFn(toggleTask);
  const deleteFn = useServerFn(deleteTask);
  const notify = useServerFn(notifyClient);

  const { data, isLoading } = useQuery({
    queryKey: ["claim", id],
    queryFn: () => fetch({ data: { id } }),
  });

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["claim", id] });
    qc.invalidateQueries({ queryKey: ["claims"] });
  }

  async function setStatus(s: string) {
    await update({ data: { id, status: s as any } });
    invalidate();
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

  const uploadUrl = data
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/upload/${data.claim.upload_token}`
    : "";

  useEffect(() => {
    if (!uploadUrl) return;
    QRCode.toDataURL(uploadUrl, { width: 320, margin: 1 }).then(setQrUrl).catch(() => {});
  }, [uploadUrl]);

  async function copyUploadUrl() {
    try {
      await navigator.clipboard.writeText(uploadUrl);
      toast.success("Odkaz zkopírován");
    } catch {
      toast.error("Nepodařilo se zkopírovat odkaz");
    }
  }

  function printQrLabel() {
    if (!qrUrl || !data) return;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    const zak = data.claim.pu_number ?? "";
    w.document.write(`<!doctype html><html><head><title>QR ${zak}</title>
      <style>
        @page { size: 80mm 100mm; margin: 4mm; }
        body { font-family: system-ui, sans-serif; text-align: center; margin: 0; padding: 8mm; }
        h1 { font-size: 14px; margin: 0 0 6mm; letter-spacing: .04em; }
        img { width: 64mm; height: 64mm; }
        .code { margin-top: 4mm; font-size: 12px; color: #555; letter-spacing: .12em; }
      </style></head><body>
      <h1>FOCENÍ DO ZAKÁZKY</h1>
      <img src="${qrUrl}" alt="QR" />
      <div class="code">${zak}</div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script>
      </body></html>`);
    w.document.close();
  }

  if (isLoading || !data) {
    return (
      <AdminShell requireModule="claims">
        <div className="p-10 text-muted-foreground">Načítám…</div>
      </AdminShell>
    );
  }

  const c = data.claim;
  const meta = statusMeta(c.status);
  const photos = data.attachments.filter((a) => (a.mime_type ?? "").startsWith("image"));

  return (
    <AdminShell requireModule="claims">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:py-10">
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na zakázky
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs uppercase text-muted-foreground">
              {c.pu_number ?? "—"}
            </div>
            <h1 className="text-2xl font-bold">{c.first_name} {c.last_name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("rounded-md border px-2 py-1 text-xs font-medium", meta.cls)}>
              {meta.label}
            </span>
            <Select value={c.status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Section title="Údaje">
          <Row label="Telefon" v={c.phone} />
          <Row label="E-mail" v={c.email} />
          <Row label="Společnost" v={c.company} />
          <Row label="IČ" v={c.ico} />
          <Row label="Adresa" v={c.address} />
          <Row label="Pojišťovna" v={c.insurer} />
          <Row label="Číslo škody" v={c.claim_number} />
          <Row label="Datum události" v={c.event_at ? new Date(c.event_at).toLocaleString("cs-CZ") : null} />
          <Row label="Místo události" v={c.location} />
          <Row label="Způsob likvidace" v={c.liquidation_type} />
          <Row label="Plátce DPH" v={c.vat_payer} />
          <Row label="Úvěr/leasing" v={c.loan_lease} />
          {c.notes && (
            <div className="sm:col-span-2">
              <div className="text-xs text-muted-foreground">Poznámka</div>
              <div className="text-sm">{c.notes}</div>
            </div>
          )}
        </Section>

        <Card>
          <CardTitle icon={<ImageIcon className="h-4 w-4" />}>
            Fotogalerie ({photos.length})
          </CardTitle>
          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Žádné fotky.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {photos.map((a) =>
                a.url ? (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                    <img
                      src={a.url}
                      alt={a.file_name}
                      className="h-20 w-20 rounded-md border object-cover"
                    />
                  </a>
                ) : null,
              )}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle icon={<FileText className="h-4 w-4" />}>Dokumenty</CardTitle>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <span>
                <span className="font-mono text-xs text-muted-foreground">[power_of_attorney]</span>{" "}
                plna-moc-jednani.pdf
              </span>
              <button onClick={() => downloadPoa("jednani")} className="text-primary hover:underline">
                Stáhnout
              </button>
            </li>
            <li className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <span>
                <span className="font-mono text-xs text-muted-foreground">[power_of_attorney]</span>{" "}
                plna-moc-prevzeti.pdf
              </span>
              <button onClick={() => downloadPoa("plneni")} className="text-primary hover:underline">
                Stáhnout
              </button>
            </li>
            {data.attachments
              .filter((a) => !(a.mime_type ?? "").startsWith("image"))
              .map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <span>
                    <span className="font-mono text-xs text-muted-foreground">[{a.category}]</span>{" "}
                    {a.file_name}
                  </span>
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Otevřít
                    </a>
                  )}
                </li>
              ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Časová osa</CardTitle>
          <ol className="space-y-2 text-sm">
            {data.events.length === 0 && (
              <li className="text-muted-foreground">Žádné události.</li>
            )}
            {data.events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("cs-CZ", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>{e.message}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Camera className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
                Focení mobilem do této složky
              </h2>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Naskenujte QR kód fotoaparátem mobilního telefonu klienta nebo mechanika. Otevře se
            nahrávací rozhraní spojené přímo s touto zakázkou{" "}
            <span className="font-semibold text-foreground">{c.pu_number ?? ""}</span>.
          </p>
          {qrUrl && (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-4">
              <img src={qrUrl} alt={`QR ${c.pu_number ?? ""}`} className="h-56 w-56" />
              <span className="text-xs tracking-widest text-muted-foreground">
                {c.pu_number ?? ""}
              </span>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={printQrLabel} disabled={!qrUrl} className="w-full gap-2">
              <Printer className="h-4 w-4" />
              Tisk QR štítku do auta
            </Button>
            <Button onClick={copyUploadUrl} variant="outline" className="w-full gap-2">
              <Copy className="h-4 w-4" />
              Zkopírovat nahrávací odkaz
            </Button>
            <a
              href={uploadUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Testovat mobilní nahrávání zde v prohlížeči
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">DPH</h2>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={c.vat_paid}
                onCheckedChange={async (v) => {
                  await setVat({ data: { id, paid: Boolean(v) } });
                  invalidate();
                }}
              />
              Zaplaceno
            </label>
          </div>
        </Card>

        <Card>
          <CardTitle>Úkoly</CardTitle>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newTask.trim()) return;
              await addTaskFn({ data: { claim_id: id, title: newTask.trim() } });
              setNewTask("");
              invalidate();
            }}
          >
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Nový úkol…"
            />
            <Button type="submit">Přidat</Button>
          </form>
          <ul className="space-y-1 text-sm">
            {data.tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
                <Checkbox
                  checked={t.done}
                  onCheckedChange={async (v) => {
                    await toggleFn({ data: { id: t.id, done: Boolean(v) } });
                    invalidate();
                  }}
                />
                <span className={cn("flex-1", t.done && "text-muted-foreground line-through")}>
                  {t.title}
                </span>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    await deleteFn({ data: { id: t.id } });
                    invalidate();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle icon={<Mail className="h-4 w-4" />}>Upozornění klientovi</CardTitle>
          {c.email ? (
            <Button
              className="w-full"
              variant="secondary"
              onClick={async () => {
                try {
                  const r = await notify({ data: { id } });
                  toast.success(`Odesláno na ${r.email}`);
                  invalidate();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Poslat upozornění
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Klient neuvedl e-mail.</p>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 rounded-xl border bg-card p-5", className)}>
      {children}
    </section>
  );
}
function CardTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-semibold">
      {icon}
      {children}
    </h2>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
    </Card>
  );
}
function Row({ label, v }: { label: string; v: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm">{v || "—"}</dd>
    </div>
  );
}