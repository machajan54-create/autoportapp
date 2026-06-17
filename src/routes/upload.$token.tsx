import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { publicGetClaimByToken, publicUploadPhoto } from "@/lib/claims.functions";
import { resizeImage } from "@/lib/resize-image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, CheckCircle2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/upload/$token")({
  head: () => ({ meta: [{ title: "Nahrát fotky do zakázky" }] }),
  component: UploadPage,
});

function UploadPage() {
  const { token } = Route.useParams();
  const get = useServerFn(publicGetClaimByToken);
  const upload = useServerFn(publicUploadPhoto);
  const { data, isLoading, error } = useQuery({
    queryKey: ["upload-claim", token],
    queryFn: () => get({ data: { token } }),
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);

  async function onFiles(list: FileList | null) {
    if (!list || !list.length) return;
    setBusy(true);
    let done = 0;
    try {
      for (const file of Array.from(list)) {
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`${file.name}: větší než 8 MB`);
          continue;
        }
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const b64 = btoa(bin);
        await upload({
          data: {
            token,
            file_name: file.name,
            mime_type: file.type || "application/octet-stream",
            data_base64: b64,
          },
        });
        done++;
        setCount((c) => c + 1);
      }
      toast.success(`Nahráno ${done} fotek`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-4">
        <div className="mx-auto flex max-w-md items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Autoport APP
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-8">
        {isLoading && <p className="text-muted-foreground">Načítám…</p>}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">
            {(error as Error).message}
          </div>
        )}
        {data && (
          <>
            <h1 className="text-xl font-bold">Nahrát fotky</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Zakázka <span className="font-mono">{data.pu_number}</span> — {data.first_name}{" "}
              {data.last_name}
            </p>
            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-10 text-primary">
              <Camera className="h-10 w-10" />
              <span className="font-medium">{busy ? "Nahrávám…" : "Vyfotit / vybrat fotky"}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                disabled={busy}
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
            {count > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                <CheckCircle2 className="h-4 w-4" />
                Celkem nahráno: {count}
              </div>
            )}
            <Button
              variant="ghost"
              className="mt-4 w-full"
              onClick={() => setCount(0)}
              disabled={busy}
            >
              Resetovat počítadlo
            </Button>
          </>
        )}
      </main>
    </div>
  );
}