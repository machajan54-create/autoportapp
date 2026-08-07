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
import {
  CheckCircle2,
  XCircle,
  FolderPlus,
  RefreshCw,
  Cloud,
  HardDrive,
  Loader2,
  Upload,
  CalendarClock,
  Play,
  ExternalLink,
  AlertTriangle,
  Github,
} from "lucide-react";
import {
  getGoogleDriveStatus,
  listGoogleDriveFolders,
  createGoogleDriveFolder,
  saveBackupSettings,
  testGoogleDriveWrite,
  runBackupNow,
  listBackupRuns,
  listBackupFiles,
  restoreBackupFromDrive,
  listStorageBackupFiles,
  restoreStorageFromDrive,
} from "@/lib/google-drive.functions";
import {
  getGithubSnapshotStatus,
  saveGithubSnapshotSettings,
  runGithubSnapshotNow,
  listGithubSnapshotRuns,
} from "@/lib/github-snapshot.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RotateCcw, Download, ShieldAlert } from "lucide-react";

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

const DOW_CS = ["neděli", "pondělí", "úterý", "středu", "čtvrtek", "pátek", "sobotu"];

function describeSchedule(s: any): string {
  if (!s) return "Plán zatím není nastavený.";
  const t = s.schedule_time ?? "02:00";
  switch (s.schedule_frequency) {
    case "interval":
      return `Záloha poběží každých ${s.schedule_interval_hours ?? 24} h.`;
    case "daily":
      return `Záloha poběží každý den v ${t}.`;
    case "monthly":
      return `Záloha poběží každý měsíc ${s.schedule_day_of_month ?? 1}. dne v ${t}.`;
    case "weekly":
    default:
      return `Záloha poběží každý týden v ${DOW_CS[s.schedule_day_of_week ?? 1]} v ${t}.`;
  }
}

function GoogleDrivePage() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getGoogleDriveStatus);
  const fetchFolders = useServerFn(listGoogleDriveFolders);
  const createFolder = useServerFn(createGoogleDriveFolder);
  const saveSettings = useServerFn(saveBackupSettings);
  const testWrite = useServerFn(testGoogleDriveWrite);
  const runBackup = useServerFn(runBackupNow);
  const fetchRuns = useServerFn(listBackupRuns);

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

  const runM = useMutation({
    mutationFn: () => runBackup({}),
    onSuccess: (data: any) => {
      const storageInfo =
        data.storageBuckets > 0
          ? `, ${data.storageBuckets} bucketů / ${data.storageFiles} souborů`
          : "";
      toast.success(
        `Záloha dokončena – ${data.tables} tabulek, ${data.rows} řádků${storageInfo} (${formatBytes(data.sizeBytes)})`,
      );
      qc.invalidateQueries({ queryKey: ["gdrive-runs"] });
      qc.invalidateQueries({ queryKey: ["gdrive-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Záloha selhala"),
  });

  const runs = useQuery({
    queryKey: ["gdrive-runs"],
    queryFn: () => fetchRuns({}),
    refetchInterval: runM.isPending ? 2000 : false,
  });

  // ---- GitHub snapshot ----
  const fetchGhStatus = useServerFn(getGithubSnapshotStatus);
  const saveGh = useServerFn(saveGithubSnapshotSettings);
  const runGh = useServerFn(runGithubSnapshotNow);
  const fetchGhRuns = useServerFn(listGithubSnapshotRuns);

  const ghStatus = useQuery({
    queryKey: ["gh-snapshot-status"],
    queryFn: () => fetchGhStatus({}),
  });

  const ghSaveM = useMutation({
    mutationFn: (input: Parameters<typeof saveGh>[0]["data"]) => saveGh({ data: input }),
    onSuccess: () => {
      toast.success("Nastavení GitHubu uloženo");
      qc.invalidateQueries({ queryKey: ["gh-snapshot-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Uložení selhalo"),
  });

  const ghRunM = useMutation({
    mutationFn: () => runGh({}),
    onSuccess: (data: any) => {
      toast.success(
        `Snapshot kódu hotový – ${formatBytes(data.sizeBytes)} (${data.driveFileName})`,
      );
      qc.invalidateQueries({ queryKey: ["gh-snapshot-runs"] });
      qc.invalidateQueries({ queryKey: ["gh-snapshot-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Snapshot kódu selhal"),
  });

  const ghRuns = useQuery({
    queryKey: ["gh-snapshot-runs"],
    queryFn: () => fetchGhRuns({}),
    refetchInterval: ghRunM.isPending ? 2000 : false,
  });

  const listFiles = useServerFn(listBackupFiles);
  const restoreFn = useServerFn(restoreBackupFromDrive);
  const listStorageFiles = useServerFn(listStorageBackupFiles);
  const restoreStorageFn = useServerFn(restoreStorageFromDrive);

  const storageFiles = useQuery({
    queryKey: ["gdrive-storage-files"],
    queryFn: () => listStorageFiles({}),
    enabled: !!status.data?.connected && !!status.data?.settings?.drive_folder_id,
  });

  const [selectedStorageFile, setSelectedStorageFile] = useState<null | {
    id: string;
    name: string;
  }>(null);
  const [storageConfirm, setStorageConfirm] = useState("");
  const [storageOverwrite, setStorageOverwrite] = useState(false);

  const restoreStorageM = useMutation({
    mutationFn: (input: {
      fileId: string;
      fileName: string;
      overwrite: boolean;
      confirm: string;
    }) => restoreStorageFn({ data: input }),
    onSuccess: (data: any) => {
      if (data.ok) {
        toast.success(
          `Soubory obnoveny – bucket ${data.bucket}: ${data.restored} souborů (přeskočeno ${data.skipped}).`,
        );
      } else {
        toast.error(`Obnova souborů dokončena s chybami (${data.errors?.length ?? 0}).`);
      }
      setSelectedStorageFile(null);
      setStorageConfirm("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Obnova souborů selhala"),
  });

  const files = useQuery({
    queryKey: ["gdrive-backup-files"],
    queryFn: () => listFiles({}),
    enabled: !!status.data?.connected && !!status.data?.settings?.drive_folder_id,
  });

  const [selectedFile, setSelectedFile] = useState<null | {
    id: string;
    name: string;
    size?: string;
    modifiedTime?: string;
  }>(null);
  const [confirmText, setConfirmText] = useState("");

  const restoreM = useMutation({
    mutationFn: (input: { fileId: string; fileName?: string; confirm: string }) =>
      restoreFn({ data: input }),
    onSuccess: (data: any) => {
      if (data.ok) {
        toast.success(`Obnova hotová – ${data.tables} tabulek, ${data.rowsRestored} řádků.`);
      } else {
        toast.error(`Obnova dokončena s chybami (${data.errors?.length ?? 0}). Viz historie běhů.`);
      }
      setSelectedFile(null);
      setConfirmText("");
      qc.invalidateQueries({ queryKey: ["gdrive-runs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Obnova selhala"),
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
                  <div className="text-sm text-muted-foreground">
                    {s.account.emailAddress ?? "—"}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs uppercase text-muted-foreground">
                    Úložiště Google Disku
                  </div>
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
                  <li>
                    Vyberte <strong>Google Drive</strong> a přihlaste se svým firemním účtem Google.
                  </li>
                  <li>
                    Vraťte se na tuto stránku a klikněte na <em>Obnovit</em>.
                  </li>
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
                    onValueChange={(v) => saveM.mutate({ schedule_frequency: v as any })}
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
                      onValueChange={(v) => saveM.mutate({ schedule_day_of_week: Number(v) })}
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

              <p className="text-xs text-muted-foreground">{describeSchedule(settings)}</p>
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
                Naposledy aktualizováno:{" "}
                {new Date(settings.last_connected_at).toLocaleString("cs-CZ")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ruční spuštění zálohy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Spustit zálohu teď
            </CardTitle>
            <CardDescription>
              Ihned vytvoří kompletní JSON zálohu databáze (gzip) a nahraje ji do vybrané složky na
              Google Disku.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => runM.mutate()}
                disabled={!connected || !settings?.drive_folder_id || runM.isPending}
              >
                {runM.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {runM.isPending ? "Zálohuje se…" : "Spustit zálohu teď"}
              </Button>
              {settings?.last_backup_at && (
                <span className="text-xs text-muted-foreground">
                  Poslední záloha: {new Date(settings.last_backup_at).toLocaleString("cs-CZ")}
                </span>
              )}
            </div>

            {runM.isPending && (
              <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Probíhá záloha – exportujeme tabulky a nahráváme na Google Disk…
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded bg-primary/10">
                  <div className="h-full w-1/2 animate-pulse rounded bg-primary" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Neopouštějte tuto stránku, dokud běh neskončí. Podle množství dat to může trvat i
                  několik minut.
                </p>
              </div>
            )}

            {runM.isError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Záloha se nezdařila</div>
                  <div className="text-xs opacity-90">
                    {(runM.error as any)?.message ?? "Neznámá chyba"}
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Historie posledních běhů</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runs.refetch()}
                  disabled={runs.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${runs.isFetching ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {runs.data?.runs?.length ? (
                <ul className="divide-y rounded-md border">
                  {runs.data.runs.map((r: any) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                      {r.status === "success" ? (
                        <Badge className="bg-green-600 hover:bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Hotovo
                        </Badge>
                      ) : r.status === "running" ? (
                        <Badge variant="secondary">
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Běží
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" /> Chyba
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.started_at).toLocaleString("cs-CZ")}
                      </span>
                      {r.trigger === "scheduled" ? (
                        <Badge variant="outline" className="text-xs">
                          plán
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          ručně
                        </Badge>
                      )}
                      {typeof r.duration_ms === "number" && (
                        <span className="text-xs text-muted-foreground">
                          {(r.duration_ms / 1000).toFixed(1)} s
                        </span>
                      )}
                      {typeof r.tables_count === "number" && (
                        <span className="text-xs text-muted-foreground">
                          {r.tables_count} tab. / {r.rows_count ?? 0} řádků
                        </span>
                      )}
                      {r.size_bytes != null && (
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(r.size_bytes)}
                        </span>
                      )}
                      {r.drive_web_view_link && (
                        <a
                          href={r.drive_web_view_link}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {r.drive_file_name ?? "otevřít"} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {r.status === "error" && r.error && (
                        <span className="w-full text-xs text-destructive">{r.error}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Zatím žádný běh zálohování.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Obnova ze zálohy */}
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              Obnova ze zálohy
            </CardTitle>
            <CardDescription>
              Vyberte zálohu z Google Disku a přepište jí aktuální data. Tato akce je nevratná –
              doporučujeme nejprve spustit novou zálohu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">
                Zálohy ve složce {status.data?.settings?.drive_folder_name ?? "—"}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => files.refetch()}
                disabled={files.isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${files.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {!status.data?.settings?.drive_folder_id ? (
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Nejprve zvolte složku pro zálohy výše.
              </div>
            ) : files.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Načítám seznam záloh…
              </div>
            ) : files.data?.files?.length ? (
              <ul className="divide-y rounded-md border">
                {files.data.files.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{f.name}</span>
                    {f.modifiedTime && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(f.modifiedTime).toLocaleString("cs-CZ")}
                      </span>
                    )}
                    {f.size && (
                      <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      {f.webViewLink && (
                        <a
                          href={f.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> otevřít
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedFile({
                            id: f.id,
                            name: f.name,
                            size: f.size,
                            modifiedTime: f.modifiedTime,
                          });
                          setConfirmText("");
                        }}
                        disabled={restoreM.isPending}
                      >
                        <Download className="h-4 w-4" /> Obnovit
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Ve vybrané složce nejsou žádné zálohy Autoportu.
              </div>
            )}
          </CardContent>
        </Card>

        {/* GitHub snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Snapshot zdrojového kódu z GitHubu
            </CardTitle>
            <CardDescription>
              Pravidelně stáhne aktuální stav repozitáře (tarball .tar.gz) a nahraje jej vedle
              databázových záloh do stejné složky na Google Disku.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!ghStatus.data?.hasToken && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <div className="font-medium">Chybí GitHub token</div>
                    <p className="text-xs text-muted-foreground">
                      Aby snapshot fungoval, musí být v projektu uložený tajný klíč
                      <span className="font-mono"> GITHUB_TOKEN</span> (fine‑grained PAT s právem
                      „Contents: Read" pro daný repozitář).
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Owner (uživatel / organizace)</Label>
                <Input
                  placeholder="např. autoport"
                  defaultValue={ghStatus.data?.settings?.github_owner ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (ghStatus.data?.settings?.github_owner ?? "")) {
                      ghSaveM.mutate({ github_owner: v || null });
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Repozitář</Label>
                <Input
                  placeholder="např. autoport-app"
                  defaultValue={ghStatus.data?.settings?.github_repo ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (ghStatus.data?.settings?.github_repo ?? "")) {
                      ghSaveM.mutate({ github_repo: v || null });
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Větev</Label>
                <Input
                  placeholder="main"
                  defaultValue={ghStatus.data?.settings?.github_branch ?? "main"}
                  onBlur={(e) => {
                    const v = e.target.value.trim() || "main";
                    if (v !== (ghStatus.data?.settings?.github_branch ?? "main")) {
                      ghSaveM.mutate({ github_branch: v });
                    }
                  }}
                />
              </div>
            </div>

            {ghStatus.data?.repo && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{ghStatus.data.repo.full_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {ghStatus.data.repo.private ? "privátní" : "veřejný"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    default: {ghStatus.data.repo.default_branch}
                  </Badge>
                  {ghStatus.data.repo.size_kb != null && (
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(ghStatus.data.repo.size_kb * 1024)}
                    </span>
                  )}
                  {ghStatus.data.repo.pushed_at && (
                    <span className="text-xs text-muted-foreground">
                      last push: {new Date(ghStatus.data.repo.pushed_at).toLocaleString("cs-CZ")}
                    </span>
                  )}
                  <a
                    href={ghStatus.data.repo.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    otevřít <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {ghStatus.data?.error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {ghStatus.data.error}
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">Týdenní automatický snapshot</div>
                <div className="text-sm text-muted-foreground">
                  Poběží automaticky každou neděli ve 3:15 do vybrané složky na Google Disku.
                </div>
              </div>
              <Switch
                checked={!!ghStatus.data?.settings?.github_auto_enabled}
                disabled={
                  !ghStatus.data?.hasToken ||
                  !ghStatus.data?.settings?.github_owner ||
                  !ghStatus.data?.settings?.github_repo ||
                  !ghStatus.data?.settings?.drive_folder_id ||
                  ghSaveM.isPending
                }
                onCheckedChange={(v) => ghSaveM.mutate({ github_auto_enabled: v })}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => ghRunM.mutate()}
                disabled={
                  !ghStatus.data?.hasToken ||
                  !ghStatus.data?.settings?.github_owner ||
                  !ghStatus.data?.settings?.github_repo ||
                  !ghStatus.data?.settings?.drive_folder_id ||
                  ghRunM.isPending
                }
              >
                {ghRunM.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {ghRunM.isPending ? "Stahuji zdroják…" : "Spustit snapshot teď"}
              </Button>
              {ghStatus.data?.settings?.last_github_snapshot_at && (
                <span className="text-xs text-muted-foreground">
                  Poslední snapshot:{" "}
                  {new Date(ghStatus.data.settings.last_github_snapshot_at).toLocaleString("cs-CZ")}
                </span>
              )}
            </div>

            {ghRunM.isPending && (
              <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Stahuji tarball z GitHubu a nahrávám na Google Disk…
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded bg-primary/10">
                  <div className="h-full w-1/2 animate-pulse rounded bg-primary" />
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Historie snapshotů</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => ghRuns.refetch()}
                  disabled={ghRuns.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${ghRuns.isFetching ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {ghRuns.data?.runs?.length ? (
                <ul className="divide-y rounded-md border">
                  {ghRuns.data.runs.map((r: any) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                      {r.status === "success" ? (
                        <Badge className="bg-green-600 hover:bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Hotovo
                        </Badge>
                      ) : r.status === "running" ? (
                        <Badge variant="secondary">
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Běží
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" /> Chyba
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.started_at).toLocaleString("cs-CZ")}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {r.trigger === "github_scheduled" ? "plán" : "ručně"}
                      </Badge>
                      {typeof r.duration_ms === "number" && (
                        <span className="text-xs text-muted-foreground">
                          {(r.duration_ms / 1000).toFixed(1)} s
                        </span>
                      )}
                      {r.size_bytes != null && (
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(r.size_bytes)}
                        </span>
                      )}
                      {r.drive_web_view_link && (
                        <a
                          href={r.drive_web_view_link}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {r.drive_file_name ?? "otevřít"} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {r.status === "error" && r.error && (
                        <span className="w-full text-xs text-destructive">{r.error}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Zatím žádný snapshot kódu.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={!!selectedFile}
        onOpenChange={(open) => {
          if (!open && !restoreM.isPending) {
            setSelectedFile(null);
            setConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Opravdu obnovit data ze zálohy?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Chystáte se přepsat aktuální data v aplikaci obsahem souboru{" "}
                  <span className="font-medium">{selectedFile?.name}</span>
                  {selectedFile?.modifiedTime && (
                    <>
                      {" "}
                      ze dne{" "}
                      <span className="font-medium">
                        {new Date(selectedFile.modifiedTime).toLocaleString("cs-CZ")}
                      </span>
                    </>
                  )}
                  . Existující záznamy v zálohovaných tabulkách budou smazány a nahrazeny obsahem
                  zálohy. Tato akce je nevratná.
                </p>
                <p className="text-xs text-muted-foreground">
                  Přeskočí se: PIN kódy zaměstnanců, audit log, e-mailová fronta, historie záloh a
                  nastavení záloh.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="confirm-restore" className="text-xs">
                    Pro potvrzení napište slovo <span className="font-mono font-bold">OBNOVIT</span>
                  </Label>
                  <Input
                    id="confirm-restore"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="OBNOVIT"
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreM.isPending}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== "OBNOVIT" || restoreM.isPending || !selectedFile}
              onClick={(e) => {
                e.preventDefault();
                if (!selectedFile) return;
                restoreM.mutate({
                  fileId: selectedFile.id,
                  fileName: selectedFile.name,
                  confirm: confirmText,
                });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {restoreM.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Obnovuji…
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" /> Obnovit data
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
