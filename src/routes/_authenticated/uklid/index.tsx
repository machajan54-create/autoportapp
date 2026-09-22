import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { queryOptions, useQueryClient, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Check, CalendarDays, History, Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMyAccess, listUsers } from "@/lib/claims.functions";
import {
  listCleaning,
  listCleaningHistory,
  toggleCleaningTask,
  saveCleaningTask,
  deleteCleaningTask,
  isTaskDueOn,
  pragueToday,
  CLEANING_CATEGORY_LABEL,
  WEEKDAY_LABEL,
} from "@/lib/cleaning.functions";
import { cn } from "@/lib/utils";

const accessOptions = queryOptions({ queryKey: ["my-access"], queryFn: () => getMyAccess({}) });
const cleaningOptions = (date: string) =>
  queryOptions({
    queryKey: ["cleaning", date],
    queryFn: () => listCleaning({ data: { date } }),
  });

export const Route = createFileRoute("/_authenticated/uklid/")({
  head: () => ({
    meta: [
      { title: "Úklid – Autoport APP" },
      { name: "description", content: "Úklidový a provozní checklist showroomu Autoport." },
      { property: "og:title", content: "Úklid – Autoport APP" },
      {
        property: "og:description",
        content: "Denní, týdenní a nepravidelné úklidové úkoly s evidencí splnění.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(accessOptions),
      context.queryClient.ensureQueryData(cleaningOptions(pragueToday())),
    ]),
  pendingComponent: () => <div className="p-8 text-sm text-muted-foreground">Načítám úklid…</div>,
  errorComponent: ({ error }: { error: Error }) => (
    <div role="alert" className="p-8 text-red-600">
      {error instanceof Error ? error.message : "Načítání selhalo"}
    </div>
  ),
  component: CleaningPage,
});

type Task = {
  id: string;
  title: string;
  frequency: string;
  weekdays: number[] | null;
  category: string;
  note: string | null;
  active: boolean;
  assignee_id?: string | null;
  assignee_name?: string | null;
};

function CleaningPage() {
  const [date, setDate] = useState(pragueToday());
  const qc = useQueryClient();
  const { data: access } = useSuspenseQuery(accessOptions);
  const { data } = useSuspenseQuery(cleaningOptions(date));
  const isAdmin = !!access?.isAdmin;

  const toggleFn = useServerFn(toggleCleaningTask);
  const saveFn = useServerFn(saveCleaningTask);
  const deleteFn = useServerFn(deleteCleaningTask);

  const doneMap = useMemo(() => {
    const m = new Map<string, { done_by_name: string | null }>();
    for (const l of data.logs as any[]) m.set(l.task_id, { done_by_name: l.done_by_name });
    return m;
  }, [data.logs]);

  const tasks = data.tasks as unknown as Task[];
  const dueToday = tasks.filter((t) => isTaskDueOn(t.weekdays, date));
  const doneCount = dueToday.filter((t) => doneMap.has(t.id)).length;

  async function toggle(taskId: string, done: boolean) {
    try {
      await toggleFn({ data: { task_id: taskId, date, done } });
      await qc.invalidateQueries({ queryKey: ["cleaning"] });
      toast.success(done ? "Označeno jako splněno" : "Splnění zrušeno");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uložení selhalo");
    }
  }

  const groups = ["daily", "weekly", "as_needed", "monthly"] as const;

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Sparkles className="h-6 w-6 text-primary" /> Úklid
            </h1>
            <p className="text-sm text-muted-foreground">Úklidový a provozní checklist</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || pragueToday())}
              className="w-[160px]"
            />
            {isAdmin && <TaskDialog onSave={saveFn} onDone={() => qc.invalidateQueries({ queryKey: ["cleaning"] })} />}
          </div>
        </div>

        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">
              <CalendarDays className="mr-2 h-4 w-4" /> Dnešní checklist
            </TabsTrigger>
            <TabsTrigger value="week">Týdenní rozpis</TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" /> Historie
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4 pt-4">
            <Card className="flex items-center justify-between p-4">
              <div className="text-sm text-muted-foreground">Splněno dnes</div>
              <div className="text-lg font-semibold">
                {doneCount} / {dueToday.length}
              </div>
            </Card>

            {groups.map((g) => {
              const rows = dueToday.filter((t) => t.category === g);
              if (rows.length === 0) return null;
              return (
                <Card key={g} className="p-4">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {CLEANING_CATEGORY_LABEL[g]}
                  </h2>
                  <ul className="divide-y">
                    {rows.map((t) => {
                      const log = doneMap.get(t.id);
                      return (
                        <li key={t.id} className="flex items-start gap-3 py-2.5">
                          <Checkbox
                            checked={!!log}
                            onCheckedChange={(v) => toggle(t.id, !!v)}
                            className="mt-1"
                            aria-label={t.title}
                          />
                          <div className="min-w-0 flex-1">
                            <div className={cn("text-sm font-medium", log && "text-muted-foreground line-through")}>
                              {t.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <Badge variant="secondary">{t.frequency}</Badge>
                              {t.note && (
                                <span className="text-xs text-muted-foreground">{t.note}</span>
                              )}
                              {log && (
                                <span className="text-xs text-emerald-600">
                                  <Check className="mr-1 inline h-3 w-3" />
                                  {log.done_by_name ?? "Splněno"}
                                </span>
                              )}
                            </div>
                          </div>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Smazat úkol"
                              onClick={async () => {
                                if (!confirm(`Smazat úkol „${t.title}“?`)) return;
                                try {
                                  await deleteFn({ data: { id: t.id } });
                                  await qc.invalidateQueries({ queryKey: ["cleaning"] });
                                  toast.success("Úkol smazán");
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Mazání selhalo");
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="week" className="pt-4">
            <Card className="p-4">
              <ul className="space-y-3">
                {[1, 2, 3, 4, 5].map((d) => {
                  const rows = tasks.filter(
                    (t) => (t.weekdays?.length ?? 0) > 0 && t.weekdays!.includes(d),
                  );
                  return (
                    <li key={d}>
                      <div className="text-sm font-semibold">{WEEKDAY_LABEL[d]}</div>
                      <div className="text-sm text-muted-foreground">
                        {rows.map((r) => r.title).join(" · ") || "—"}
                      </div>
                    </li>
                  );
                })}
                <li>
                  <div className="text-sm font-semibold">Dle potřeby</div>
                  <div className="text-sm text-muted-foreground">
                    {tasks
                      .filter((t) => (t.weekdays?.length ?? 0) === 0)
                      .map((t) => t.title)
                      .join(" · ") || "—"}
                  </div>
                </li>
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            <HistoryList />
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}

function HistoryList() {
  const fetchHistory = useServerFn(listCleaningHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["cleaning-history"],
    queryFn: () => fetchHistory({ data: { days: 14 } }),
  });
  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Načítám historii…</div>;
  const rows = (data?.rows ?? []) as any[];
  if (rows.length === 0)
    return <div className="p-4 text-sm text-muted-foreground">Zatím žádné záznamy.</div>;
  return (
    <Card className="divide-y p-2">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 px-2 py-2 text-sm">
          <span className="truncate">{r.cleaning_tasks?.title ?? "—"}</span>
          <span className="shrink-0 text-muted-foreground">
            {r.log_date} · {r.done_by_name ?? "—"}
          </span>
        </div>
      ))}
    </Card>
  );
}

function TaskDialog({ onSave, onDone }: { onSave: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState("Dle potřeby");
  const [category, setCategory] = useState<"daily" | "weekly" | "as_needed" | "monthly">("weekly");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) return toast.error("Zadejte název úkolu");
    setSaving(true);
    try {
      await onSave({ data: { title, frequency, category, weekdays, note, active: true } });
      toast.success("Úkol přidán");
      setOpen(false);
      setTitle("");
      setNote("");
      setWeekdays([]);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uložení selhalo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Nový úkol
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nový úklidový úkol</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Název</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Frekvence (popis)</Label>
            <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} />
          </div>
          <div>
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLEANING_CATEGORY_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dny v týdnu (prázdné = dle potřeby)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={weekdays.includes(d) ? "default" : "outline"}
                  onClick={() =>
                    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))
                  }
                >
                  {WEEKDAY_LABEL[d].slice(0, 2)}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>Poznámka</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
