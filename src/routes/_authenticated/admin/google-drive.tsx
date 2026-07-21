import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, XCircle, FolderPlus, RefreshCw, Cloud, HardDrive, Loader2, Upload, CalendarClock } from "lucide-react";
import {
  getGoogleDriveStatus,
  listGoogleDriveFolders,
  createGoogleDriveFolder,
  saveBackupSettings,
  testGoogleDriveWrite,
} from "@/lib/google-drive.functions";

export const Route = createFileRoute("/_authenticated/admin/google-drive")({
  component: GoogleDrivePage,
  head: () => ({
    meta: [{ title: "Google Disk – Autoport Admin" }],
  }),
});

function formatBytes(bytes?: number | string | null) {
  if (bytes == null) return "—";
  const n = typeof bytes === "string" ? Number(bytes) : bytes;
  if (!Number.isFinite(n)) return "—";
  const units = ["B", "kB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function GoogleDrivePage() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getGoogleDriveStatus);
  const fetchFolders = useServerFn(listGoogleDriveFolders);
  const createFolder = useServerFn(createGoogleDriveFolder);
  const saveSettings = useServerFn(saveBackupSettings);
  const testWrite = useServerFn(testGoogleDriveWrite);

  const [folderQuery, setFolderQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState("");

  const status = useQuery({
    queryKey: ["gdrive-status"],
    queryFn: () => fetchStatus({}),
  });

  const folders = useQuery({
    queryKey: ["gdrive-folders", folderQuery],
    queryFn: () => fetchFolders({ data: { query: folderQuery || undefined } }),
    enabled: !!status.data?.connected,
  });

  const saveM = useMutation({
    mutationFn: (input: Parameters<typeof saveSettings>[0]["data"]) =>
      saveSettings({ data: input }),
    onSuccess: () => {
      toast.success("Nastavení uloženo");
      qc.invalidateQueries({ queryKey: ["gdrive-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Uložení selhalo"),
  });

  const createM = useMutation({
    mutationFn: (name: string) => createFolder({ data: { name } }),
    onSuccess: (data: any) => {
      toast.success(`Složka „${data?.name}" vytvořena`);
      setNewFolderName("");
      folders.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Vytvoření složky selhalo"),
  });

  const testM = useMutation({
    mutationFn: () => testWrite({}),
    onSuccess: (data: any) => {
      toast.success(`Testovací soubor „${data?.name}" nahrán na Google Disk`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Test selhal"),
  });

  const s = status.data;
  const settings = s?.settings;
  const connected = !!s?.connected;

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Cloud className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Google Disk</h1>
            <p className="text-sm text-muted-foreground">
              Nastavení účtu Google a cílové složky pro automatické zálohy.
            </p>
          </div>
        </div>

        {/* Stav připojení */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {status.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : connected ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  Stav připojení
                </CardTitle>
                <CardDescription>
                  {connected
                    ? "Aplikace je propojena s Google účtem přes konektor."
                    : "Google Disk zatím není propojen."}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => status.refetch()}
                disabled={status.isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${status.isFetching ? "animate-spin" : ""}`} />
                Obnovit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {s?.error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {s.error}
              </div>
            )}
            {connected && s?.account && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="text-xs uppercase text-muted-foreground">Účet Google</div>
                  <div className="mt-1 font-medium">{s.account.displayName ?? "—"}</div>
                  <div className="text-sm text-muted-foreground">{s.account.emailAddress ?? "—"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs uppercase text-muted-foreground">Úložiště Google Disku</div>
                  <div className="mt-1 font-medium">
                    {formatBytes(s.account.storageQuota?.usage)} využito
                  </div>
                  <div className="text-sm text-muted-foreground">
                    z {formatBytes(s.account.storageQuota?.limit)} celkem
                  </div>
                </div>
              </div>
            )}
            {!connected && (
              <div className="rounded-md border bg-muted/40 p-4 text-sm">
                <p className="mb-2 font-medium">Jak propojit účet Google:</p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Otevřete v Lovable panel „Connectors" nahoře v editoru.</li>
                  <li>Vyberte <strong>Google Drive</strong> a přihlaste se svým firemním účtem Google.</li>
                  <li>Vraťte se na tuto stránku a klikněte na <em>Obnovit</em>.</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cílová složka */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Cílová složka pro zálohy
            </CardTitle>
            <CardDescription>
              Do této složky se budou ukládat všechny automatické i ruční zálohy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Aktuálně vybráno: </span>
              {settings?.drive_folder_id ? (
                <span className="font-medium">
                  {settings.drive_folder_name ?? settings.drive_folder_id}
                </span>
              ) : (
                <Badge variant="outline">nevybráno</Badge>
              )}
            </div>

            <div className="flex flex-col gap-2 md:flex-row">
              <Input
                placeholder="Hledat složku podle názvu…"
                value={folderQuery}
                onChange={(e) => setFolderQuery(e.target.value)}
                disabled={!connected}
              />
              <Button
                variant="outline"
                onClick={() => folders.refetch()}
                disabled={!connected || folders.isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${folders.isFetching ? "animate-spin" : ""}`} />
                Načíst
              </Button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border">
              {!connected ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Nejprve propojte účet Google.
                </div>
              ) : folders.isLoading ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Načítám složky…
                </div>
              ) : (folders.data?.folders ?? []).length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Žádné složky.</div>
              ) : (
                <ul className="divide-y">
                  {folders.data!.folders.map((f: any) => {
                    const selected = settings?.drive_folder_id === f.id;
                    return (
                      <li
                        key={f.id}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">{f.name}</div>
                          <div className="text-xs text-muted-foreground">{f.id}</div>
                        </div>
                        <Button
                          size="sm"
                          variant={selected ? "secondary" : "outline"}
                          onClick={() =>
                            saveM.mutate({
                              drive_folder_id: f.id,
                              drive_folder_name: f.name,
                              drive_account_email: s?.account?.emailAddress ?? null,
                            })
                          }
                          disabled={saveM.isPending}
                        >
                          {selected ? "Vybráno" : "Vybrat"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm">Vytvořit novou složku v kořeni Disku</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Např. Autoport zálohy"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  disabled={!connected}
                />
                <Button
                  onClick={() => createM.mutate(newFolderName.trim())}
                  disabled={!connected || !newFolderName.trim() || createM.isPending}
                >
                  <FolderPlus className="h-4 w-4" />
                  Vytvořit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nastavení + test */}
        <Card>
          <CardHeader>
            <CardTitle>Automatické zálohování</CardTitle>
            <CardDescription>
              Při zapnutí poběží zálohy pravidelně (dle nastaveného cronu) do vybrané složky.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">Zapnout automatické zálohy</div>
                <div className="text-sm text-muted-foreground">
                  Vyžaduje propojený účet a vybranou cílovou složku.
                </div>
              </div>
              <Switch
                checked={!!settings?.auto_backup_enabled}
                disabled={!connected || !settings?.drive_folder_id || saveM.isPending}
                onCheckedChange={(v) => saveM.mutate({ auto_backup_enabled: v })}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <div className="font-medium">Plán spouštění</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Frekvence</Label>
                  <Select
                    value={settings?.schedule_frequency ?? "weekly"}
                    onValueChange={(v) =>
                      saveM.mutate({ schedule_frequency: v as any })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interval">Podle intervalu (hodiny)</SelectItem>
                      <SelectItem value="daily">Každý den v čase</SelectItem>
                      <SelectItem value="weekly">Týdně v konkrétní den a čas</SelectItem>
                      <SelectItem value="monthly">Měsíčně v konkrétní den a čas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings?.schedule_frequency === "interval" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Interval (hodin)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      defaultValue={settings?.schedule_interval_hours ?? 24}
                      onBlur={(e) => {
                        const n = Math.max(1, Math.min(168, Number(e.target.value) || 24));
                        saveM.mutate({ schedule_interval_hours: n });
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Čas spuštění</Label>
                    <Input
                      type="time"
                      defaultValue={settings?.schedule_time ?? "02:00"}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) {
                          saveM.mutate({ schedule_time: v });
                        }
                      }}
                    />
                  </div>
                )}

                {settings?.schedule_frequency === "weekly" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Den v týdnu</Label>
                    <Select
                      value={String(settings?.schedule_day_of_week ?? 1)}
                      onValueChange={(v) =>
                        saveM.mutate({ schedule_day_of_week: Number(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Pondělí</SelectItem>
                        <SelectItem value="2">Úterý</SelectItem>
                        <SelectItem value="3">Středa</SelectItem>
                        <SelectItem value="4">Čtvrtek</SelectItem>
                        <SelectItem value="5">Pátek</SelectItem>
                        <SelectItem value="6">Sobota</SelectItem>
                        <SelectItem value="0">Neděle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {settings?.schedule_frequency === "monthly" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Den v měsíci</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      defaultValue={settings?.schedule_day_of_month ?? 1}
                      onBlur={(e) => {
                        const n = Math.max(1, Math.min(31, Number(e.target.value) || 1));
                        saveM.mutate({ schedule_day_of_month: n });
                      }}
                    />
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {describeSchedule(settings)}
              </p>
            </div>

            <Separator />

            <Button
              variant="outline"
              onClick={() => testM.mutate()}
              disabled={!connected || !settings?.drive_folder_id || testM.isPending}
            >
              {testM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Nahrát testovací soubor
            </Button>

            {settings?.last_connected_at && (
              <div className="text-xs text-muted-foreground">
                Naposledy aktualizováno: {new Date(settings.last_connected_at).toLocaleString("cs-CZ")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}