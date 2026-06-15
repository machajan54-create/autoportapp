import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/SignaturePad";
import { CheckCircle2, Loader2 } from "lucide-react";
import { getOrderByToken, signOrderRemote } from "@/lib/demo-orders.functions";

export const Route = createFileRoute("/sign/$token")({
  ssr: false,
  component: SignPage,
});

function SignPage() {
  const { token } = useParams({ from: "/sign/$token" });
  const fetchOrder = useServerFn(getOrderByToken);
  const signFn = useServerFn(signOrderRemote);

  const [signerName, setSignerName] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sign-token", token],
    queryFn: () => fetchOrder({ data: { token } }),
    retry: false,
  });

  const pdfUrl = useMemo(() => {
    if (!data?.pdfBase64) return null;
    const bin = atob(data.pdfBase64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
  }, [data?.pdfBase64]);

  async function onSubmit() {
    if (!signerName.trim() || !sig) { toast.error("Doplňte jméno a podpis"); return; }
    setSubmitting(true);
    try {
      await signFn({ data: { token, signatureDataUrl: sig, signerName: signerName.trim() } });
      setDone(true);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Načítám…</div>;
  }
  if (error) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-semibold">Odkaz není platný</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }
  if (done) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-semibold">Podepsáno</h1>
        <p className="mt-2 text-sm text-muted-foreground">Děkujeme. Podepsanou objednávku obdržíte e-mailem.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Podpis objednávky {data?.order.order_number}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {data?.order.model_verze} · {data?.client?.full_name || data?.client?.company}
      </p>

      {pdfUrl && (
        <div className="mt-6 overflow-hidden rounded-xl border bg-card">
          <iframe src={pdfUrl} title="Objednávka" className="h-[60vh] w-full" />
        </div>
      )}

      <div className="mt-6 rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">Váš podpis</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Jméno</Label>
            <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
          </div>
          <SignaturePad onChange={setSig} />
          <Button onClick={onSubmit} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Potvrdit a odeslat podpis
          </Button>
        </div>
      </div>
    </div>
  );
}