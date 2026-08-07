import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wrench, Plus, Trash2, ImageIcon, Loader2, X } from "lucide-react";
import { RequestDeleteButton } from "@/components/RequestDeleteButton";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyAccess } from "@/lib/claims.functions";
import {
  listDefects,
  createDefect,
  updateDefect,
  getDefectPhotoUrls,
  DEFECT_PRIORITY,
  DEFECT_STATUS,
  DEFECT_PRIORITY_LABEL,
  DEFECT_STATUS_LABEL,
} from "@/lib/defects.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/zavady/")({
  component: DefectsPage,
});

type Photo = { path: string; name: string };

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-700",
};

const STATUS_STYLE: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-700",
};

function DefectsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listDefects);
  const fetchAccess = useServerFn(getMyAccess);
  const createFn = useServerFn(createDefect);
  const updateFn = useServerFn(updateDefect);
  const signFn = useServerFn(getDefectPhotoUrls);

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: access } = useQuery({ queryKey: ["my-access"], queryFn: () => fetchAccess({}) });
  const isAdmin = !!access?.isAdmin;

  const { data, isLoading } = useQuery({
    queryKey: ["defects"],
    queryFn: () => fetchList({}),
  });
  const rows = data?.rows ?? [];

  const [filter, setFilter] = useState<"all" | "open" | "mine">("all");
  const visible = useMemo(() => {
    if (filter === "open")
      return rows.filter((r) => r.status === "new" || r.status === "in_progress");
    if (filter === "mine") return rows.filter((r) => r.reported_by === userId);
    return rows;
  }, [rows, filter, userId]);

  const allPaths = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const photos = (r.photos as Photo[] | null) ?? [];
      photos.forEach((p) => p?.path && set.add(p.path));
    });
    return Array.from(set);
  }, [rows]);

  const { data: signed } = useQuery({
    queryKey: ["defect-photos", allPaths],
    queryFn: () => signFn({ data: { paths: allPaths } }),
    enabled: allPaths.length > 0,
  });
  const photoUrls = signed?.urls ?? {};

  const [createOpen, setCreateOpen] = useState(false);

  async function handleStatus(id: string, status: (typeof DEFECT_STATUS)[number]) {
    try {
      await updateFn({ data: { id, status } });
      toast.success("Stav aktualizován");
      qc.invalidateQueries({ queryKey: ["defects"] });
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se uložit");
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Závady</h1>
              <p className="text-sm text-muted-foreground">
                Interní hlášení technických závad a problémů.
              </p>
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nahlásit závadu
              </Button>
            </DialogTrigger>
            <CreateDefectDialog
              onClose={() => setCreateOpen(false)}
              onCreated={() => {
                setCreateOpen(false);
                qc.invalidateQueries({ queryKey: ["defects"] });
              }}
              createFn={createFn}
            />
          </Dialog>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">Vše ({rows.length})</TabsTrigger>
            <TabsTrigger value="open">
              Otevřené (
              {rows.filter((r) => r.status === "new" || r.status === "in_progress").length})
            </TabsTrigger>
            <TabsTrigger value="mine">
              Moje ({rows.filter((r) => r.reported_by === userId).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">Žádné závady k zobrazení.</Card>
        ) : (
          <div className="grid gap-4">
            {visible.map((r) => {
              const photos = ((r.photos as Photo[] | null) ?? []).filter((p) => p?.path);
              const canEdit = isAdmin || r.reported_by === userId;
              return (
                <Card key={r.id} className="p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">{r.title}</h3>
                        <Badge className={cn("border-transparent", PRIORITY_STYLE[r.priority])}>
                          {DEFECT_PRIORITY_LABEL[r.priority] ?? r.priority}
                        </Badge>
                        <Badge className={cn("border-transparent", STATUS_STYLE[r.status])}>
                          {DEFECT_STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Nahlásil: {r.reporter_name ?? "—"} ·{" "}
                        {new Date(r.created_at).toLocaleString("cs-CZ")}
                        {r.resolved_at && r.resolver_name && (
                          <>
                            {" "}
                            · Vyřešil: {r.resolver_name} (
                            {new Date(r.resolved_at).toLocaleDateString("cs-CZ")})
                          </>
                        )}
                      </div>
                      {r.description && (
                        <p className="mt-2 whitespace-pre-wrap text-sm">{r.description}</p>
                      )}
                      {photos.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {photos.map((p) => {
                            const url = photoUrls[p.path];
                            const isImage = /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)$/i.test(
                              p.name,
                            );
                            return url ? (
                              isImage ? (
                                <a
                                  key={p.path}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-20 w-20 overflow-hidden rounded-md border bg-muted"
                                >
                                  <img
                                    src={url}
                                    alt={p.name}
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ) : (
                                <a
                                  key={p.path}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex h-20 w-20 flex-col items-center justify-center rounded-md border bg-muted p-1 text-center text-[10px] text-muted-foreground hover:bg-muted/70"
                                  title={p.name}
                                >
                                  <ImageIcon className="mb-1 h-5 w-5" />
                                  <span className="line-clamp-2 break-all">{p.name}</span>
                                </a>
                              )
                            ) : (
                              <div
                                key={p.path}
                                className="flex h-20 w-20 items-center justify-center rounded-md border bg-muted text-muted-foreground"
                              >
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isAdmin && (
                        <Select
                          value={r.status}
                          onValueChange={(v) =>
                            handleStatus(r.id, v as (typeof DEFECT_STATUS)[number])
                          }
                        >
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEFECT_STATUS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {DEFECT_STATUS_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {canEdit && (
                        <RequestDeleteButton
                          entityType="defects"
                          entityId={r.id}
                          entityLabel={`Vada: ${r.title ?? ""}`}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          title="Požádat o smazání závady"
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Smazat
                        </RequestDeleteButton>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function CreateDefectDialog({
  onClose,
  onCreated,
  createFn,
}: {
  onClose: () => void;
  onCreated: () => void;
  createFn: (args: {
    data: {
      title: string;
      description?: string | null;
      priority: (typeof DEFECT_PRIORITY)[number];
      photos: Photo[];
    };
  }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<(typeof DEFECT_PRIORITY)[number]>("medium");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    if (photos.length + files.length > 10) {
      toast.error("Maximálně 10 fotek na závadu");
      return;
    }
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Nejste přihlášen");
      const uploaded: Photo[] = [];
      for (const file of Array.from(files)) {
        const { resizeImage } = await import("@/lib/resize-image");
        const resized = await resizeImage(file, { maxWidth: 1920, maxHeight: 1920 });
        if (resized.size > 10 * 1024 * 1024) {
          toast.error(`Soubor ${resized.name} je větší než 10 MB`);
          continue;
        }
        const ext = resized.name.split(".").pop() || "jpg";
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("defect-photos").upload(path, resized, {
          upsert: false,
          contentType: resized.type || undefined,
        });
        if (error) {
          toast.error(`Nahrání selhalo: ${error.message}`);
          continue;
        }
        uploaded.push({ path, name: resized.name });
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(path: string) {
    await supabase.storage.from("defect-photos").remove([path]);
    setPhotos((prev) => prev.filter((p) => p.path !== path));
  }

  async function submit() {
    if (!title.trim()) {
      toast.error("Vyplňte název závady");
      return;
    }
    setSubmitting(true);
    try {
      await createFn({
        data: {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          photos,
        },
      });
      toast.success("Závada nahlášena");
      setTitle("");
      setDescription("");
      setPriority("medium");
      setPhotos([]);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se uložit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Nová závada</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="d-title">Název *</Label>
          <Input
            id="d-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Krátký popis závady"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-desc">Popis</Label>
          <Textarea
            id="d-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            rows={4}
            placeholder="Detailní popis, kde se závada projevuje…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Priorita</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as (typeof DEFECT_PRIORITY)[number])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEFECT_PRIORITY.map((p) => (
                <SelectItem key={p} value={p}>
                  {DEFECT_PRIORITY_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Přílohy ({photos.length}/10)</Label>
          <Input
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
            multiple
            disabled={uploading || photos.length >= 10}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((p) => (
                <div
                  key={p.path}
                  className="relative flex h-16 w-24 items-center justify-center rounded border bg-muted px-2 text-xs text-muted-foreground"
                >
                  <span className="truncate">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => removePhoto(p.path)}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    aria-label="Odebrat"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Zrušit
        </Button>
        <Button onClick={submit} disabled={submitting || uploading}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Nahlásit
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
