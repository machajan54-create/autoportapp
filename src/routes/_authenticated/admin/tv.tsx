import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ExternalLink,
  Plus,
  Save,
  Trash2,
  GripVertical,
  Copy,
  ImagePlus,
  Tv,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tv")({
  component: TvAdmin,
});

type Slide = {
  id: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  type: "news" | "promo" | "vehicle" | "video";
  duration_sec: number;
  sort_order: number;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
};

type DisplayConfig = {
  id: string;
  name: string;
  token: string;
  ticker_text: string | null;
  show_weather: boolean;
  show_clock: boolean;
};

const TYPE_LABELS: Record<Slide["type"], string> = {
  news: "Novinka",
  promo: "Akce",
  vehicle: "Vozidlo",
  video: "Video",
};

function toDatetimeLocal(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function TvAdmin() {
  const qc = useQueryClient();

  const slidesQ = useQuery({
    queryKey: ["tv-slides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slides")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Slide[];
    },
  });

  const configQ = useQuery({
    queryKey: ["tv-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("display_config")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as DisplayConfig[];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Slide> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const slides = slidesQ.data ?? [];
  const configs = configQ.data ?? [];
  const activeConfig = configs[0];

  useEffect(() => {
    if (!selectedId && slides.length) {
      setSelectedId(slides[0].id);
      setDraft(slides[0]);
    }
  }, [selectedId, slides]);

  function pick(s: Slide) {
    setSelectedId(s.id);
    setDraft(s);
  }

  async function newSlide() {
    const max = slides.reduce((m, s) => Math.max(m, s.sort_order), 0);
    const { data, error } = await supabase
      .from("slides")
      .insert({
        title: "Nový slide",
        type: "news",
        duration_sec: 12,
        sort_order: max + 10,
        active: true,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success("Slide vytvořen");
    qc.invalidateQueries({ queryKey: ["tv-slides"] });
    setSelectedId(data.id);
    setDraft(data as Slide);
  }

  async function save() {
    if (!draft?.id) return;
    const payload = {
      title: draft.title ?? null,
      subtitle: draft.subtitle ?? null,
      body: draft.body ?? null,
      image_url: draft.image_url ?? null,
      type: draft.type ?? "news",
      duration_sec: Number(draft.duration_sec) || 12,
      active: !!draft.active,
      valid_from: draft.valid_from || null,
      valid_to: draft.valid_to || null,
    };
    const { error } = await supabase.from("slides").update(payload).eq("id", draft.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Uloženo");
    qc.invalidateQueries({ queryKey: ["tv-slides"] });
  }

  async function remove(id: string) {
    if (!confirm("Opravdu smazat tento slide?")) return;
    const { error } = await supabase.from("slides").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Smazáno");
    if (selectedId === id) { setSelectedId(null); setDraft(null); }
    qc.invalidateQueries({ queryKey: ["tv-slides"] });
  }

  async function toggleActive(s: Slide) {
    const { error } = await supabase.from("slides").update({ active: !s.active }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tv-slides"] });
    if (draft?.id === s.id) setDraft({ ...draft, active: !s.active });
  }

  async function uploadImage(file: File) {
    if (!draft?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${draft.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("slides").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      setDraft((d) => ({ ...(d ?? {}), image_url: path }));
      const { error: updErr } = await supabase.from("slides").update({ image_url: path }).eq("id", draft.id);
      if (updErr) throw updErr;
      qc.invalidateQueries({ queryKey: ["tv-slides"] });
      toast.success("Obrázek nahrán");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // Drag & drop reordering
  async function onDrop(overId: string, draggedId: string) {
    if (overId === draggedId) return;
    const list = [...slides];
    const from = list.findIndex((s) => s.id === draggedId);
    const to = list.findIndex((s) => s.id === overId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const updates = list.map((s, i) => ({ id: s.id, sort_order: (i + 1) * 10 }));
    // Optimistic
    qc.setQueryData<Slide[]>(["tv-slides"], list.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 })));
    for (const u of updates) {
      const { error } = await supabase.from("slides").update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) { toast.error(error.message); break; }
    }
    qc.invalidateQueries({ queryKey: ["tv-slides"] });
  }

  const tvUrl = useMemo(() => {
    if (typeof window === "undefined" || !activeConfig) return "";
    return `${window.location.origin}/tv/${activeConfig.token}`;
  }, [activeConfig]);

  return (
    <AdminShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Digital signage</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <Tv className="h-6 w-6" /> TV Display
            </h1>
          </div>
          {tvUrl && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { navigator.clipboard.writeText(tvUrl); toast.success("Odkaz zkopírován"); }}
              >
                <Copy className="mr-1.5 h-4 w-4" /> Kopírovat odkaz
              </Button>
              <Button size="sm" onClick={() => window.open(tvUrl, "_blank", "noopener")}>
                <ExternalLink className="mr-1.5 h-4 w-4" /> Otevřít TV náhled
              </Button>
            </div>
          )}
        </div>

        {/* Display config */}
        {activeConfig && (
          <Card className="mt-6 p-4">
            <h2 className="mb-3 text-sm font-semibold">Konfigurace displeje</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>Název</Label>
                <Input
                  value={activeConfig.name}
                  onChange={(e) => qc.setQueryData<DisplayConfig[]>(["tv-configs"], (prev) =>
                    (prev ?? []).map((c) => c.id === activeConfig.id ? { ...c, name: e.target.value } : c))}
                  onBlur={async (e) => {
                    await supabase.from("display_config").update({ name: e.target.value }).eq("id", activeConfig.id);
                  }}
                />
              </div>
              <div>
                <Label>Token (v URL)</Label>
                <div className="flex gap-2">
                  <Input value={activeConfig.token} readOnly className="font-mono text-xs" />
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Běžící text (ticker)</Label>
                <Input
                  value={activeConfig.ticker_text ?? ""}
                  onChange={(e) => qc.setQueryData<DisplayConfig[]>(["tv-configs"], (prev) =>
                    (prev ?? []).map((c) => c.id === activeConfig.id ? { ...c, ticker_text: e.target.value } : c))}
                  onBlur={async (e) => {
                    await supabase.from("display_config").update({ ticker_text: e.target.value }).eq("id", activeConfig.id);
                    toast.success("Ticker uložen");
                  }}
                  placeholder="Text co poběží dole na displeji…"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={activeConfig.show_clock}
                  onCheckedChange={async (v) => {
                    await supabase.from("display_config").update({ show_clock: v }).eq("id", activeConfig.id);
                    qc.invalidateQueries({ queryKey: ["tv-configs"] });
                  }}
                />
                <Label>Zobrazovat hodiny a datum</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={activeConfig.show_weather}
                  onCheckedChange={async (v) => {
                    await supabase.from("display_config").update({ show_weather: v }).eq("id", activeConfig.id);
                    qc.invalidateQueries({ queryKey: ["tv-configs"] });
                  }}
                />
                <Label>Zobrazovat počasí</Label>
              </div>
            </div>
          </Card>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
          {/* Slide list */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Slidy ({slides.length})</h2>
              <Button size="sm" onClick={newSlide}>
                <Plus className="mr-1 h-4 w-4" /> Nový
              </Button>
            </div>
            <div className="space-y-2">
              {slides.map((s) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(s.id); }}
                  onDragLeave={() => setDragOverId((v) => (v === s.id ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    setDragOverId(null);
                    if (id) onDrop(s.id, id);
                  }}
                  onClick={() => pick(s)}
                  className={
                    "flex cursor-pointer items-center gap-2 rounded-md border bg-card p-2 text-sm transition " +
                    (selectedId === s.id ? "border-primary ring-1 ring-primary/20 " : "hover:bg-muted ") +
                    (dragOverId === s.id ? "border-dashed border-primary/60 " : "")
                  }
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 truncate">
                    <div className="truncate font-medium">{s.title || "(bez názvu)"}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">{TYPE_LABELS[s.type]}</Badge>
                      <span>{s.duration_sec}s</span>
                    </div>
                  </div>
                  <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} />
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(s.id); }}
                    className="rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!slides.length && (
                <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
                  Zatím žádné slidy. Klikněte na „Nový“.
                </div>
              )}
            </div>
          </div>

          {/* Editor + preview */}
          <div>
            {!draft ? (
              <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
                Vyberte slide nebo vytvořte nový.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold">Obsah</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>Nadpis</Label>
                      <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                    </div>
                    <div>
                      <Label>Podnadpis</Label>
                      <Input value={draft.subtitle ?? ""} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />
                    </div>
                    <div>
                      <Label>Text</Label>
                      <Textarea rows={4} value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Typ</Label>
                        <Select value={draft.type ?? "news"} onValueChange={(v) => setDraft({ ...draft, type: v as Slide["type"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(TYPE_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Doba (s)</Label>
                        <Input
                          type="number" min={3} max={600}
                          value={draft.duration_sec ?? 12}
                          onChange={(e) => setDraft({ ...draft, duration_sec: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Platnost od</Label>
                        <Input
                          type="datetime-local"
                          value={toDatetimeLocal(draft.valid_from ?? null)}
                          onChange={(e) => setDraft({ ...draft, valid_from: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        />
                      </div>
                      <div>
                        <Label>Platnost do</Label>
                        <Input
                          type="datetime-local"
                          value={toDatetimeLocal(draft.valid_to ?? null)}
                          onChange={(e) => setDraft({ ...draft, valid_to: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Obrázek</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
                          disabled={uploading}
                        />
                        {draft.image_url && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setDraft({ ...draft, image_url: null })}
                          >
                            Odebrat
                          </Button>
                        )}
                      </div>
                      {draft.image_url && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">{draft.image_url}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch
                        checked={!!draft.active}
                        onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                      />
                      <Label>Aktivní</Label>
                      <Button className="ml-auto" onClick={save}>
                        <Save className="mr-1.5 h-4 w-4" /> Uložit
                      </Button>
                    </div>
                  </div>
                </Card>
                <SlidePreview draft={draft} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function SlidePreview({ draft }: { draft: Partial<Slide> }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!draft.image_url) { setImgUrl(null); return; }
      if (/^https?:\/\//i.test(draft.image_url) || draft.image_url.startsWith("data:")) {
        setImgUrl(draft.image_url); return;
      }
      const { data } = await supabase.storage.from("slides").createSignedUrl(draft.image_url, 3600);
      if (!cancelled) setImgUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [draft.image_url]);

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Živý náhled (16:9)</h3>
      <div
        className="relative w-full overflow-hidden rounded-md bg-slate-900 text-white"
        style={{ aspectRatio: "16/9" }}
      >
        {imgUrl && (
          <div
            style={{
              position: "absolute", inset: 0,
              backgroundImage: `url(${imgUrl})`,
              backgroundSize: "cover", backgroundPosition: "center",
            }}
          />
        )}
        <div
          style={{
            position: "absolute", inset: 0,
            background: imgUrl
              ? "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)"
              : "radial-gradient(ellipse at center, #1f2b47 0%, #0b0f1a 100%)",
          }}
        />
        <div style={{ position: "absolute", inset: "5%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          {draft.type && (
            <div
              style={{
                display: "inline-block", alignSelf: "flex-start",
                padding: "2px 8px", background: "#f97316", color: "white",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                borderRadius: 4, marginBottom: 8,
              }}
            >{TYPE_LABELS[draft.type as Slide["type"]] ?? draft.type}</div>
          )}
          {draft.title && <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05 }}>{draft.title}</div>}
          {draft.subtitle && <div style={{ fontSize: 16, marginTop: 4, opacity: 0.9 }}>{draft.subtitle}</div>}
          {draft.body && <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85, maxWidth: "70%" }}>{draft.body}</div>}
        </div>
      </div>
    </Card>
  );
}