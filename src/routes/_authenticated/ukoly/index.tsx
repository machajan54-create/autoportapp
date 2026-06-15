import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckSquare, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listResolvers } from "@/lib/dochazka.functions";
import {
  listTasks, createTask, updateTask, deleteTask,
  TASK_PRIORITY, TASK_STATUS, TASK_PRIORITY_LABEL, TASK_STATUS_LABEL,
} from "@/lib/tasks.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ukoly/")({
  component: TasksPage,
});

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-800",
};
const STATUS_STYLE: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-700",
};

function TasksPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listTasks);
  const fetchUsers = useServerFn(listResolvers);
  const createFn = useServerFn(createTask);
  const updateFn = useServerFn(updateTask);
  const deleteFn = useServerFn(deleteTask);

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data, isLoading } = useQuery({ queryKey: ["tasks"], queryFn: () => fetchList({}) });
  const { data: users } = useQuery({ queryKey: ["dochazka", "users"], queryFn: () => fetchUsers({}) });
  const rows = data?.rows ?? [];

  const [filter, setFilter] = useState<"open" | "mine" | "all">("open");
  const visible = useMemo(() => {
    if (filter === "open") return rows.filter((r) => r.status !== "done");
    if (filter === "mine") return rows.filter((r) => r.assignee_id === userId);
    return rows;
  }, [rows, filter, userId]);

  const [createOpen, setCreateOpen] = useState(false);

  async function handleStatus(id: string, status: typeof TASK_STATUS[number]) {
    try {
      await updateFn({ data: { id, status } });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se uložit");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Opravdu smazat tento úkol?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Úkol smazán");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se smazat");
    }
  }

  return (
    <AdminShell requireModule={["tasks" as any]}>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <CheckSquare className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Úkoly</h1>
              <p className="text-sm text-muted-foreground">
                Sledování úkolů, přiřazení a stavu.
              </p>
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nový úkol</Button>
            </DialogTrigger>
            <CreateTaskDialog
              users={users ?? []}
              onClose={() => setCreateOpen(false)}
              onCreated={() => {
                setCreateOpen(false);
                qc.invalidateQueries({ queryKey: ["tasks"] });
              }}
              createFn={createFn}
            />
          </Dialog>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="open">Otevřené ({rows.filter((r) => r.status !== "done").length})</TabsTrigger>
            <TabsTrigger value="mine">Moje ({rows.filter((r) => r.assignee_id === userId).length})</TabsTrigger>
            <TabsTrigger value="all">Vše ({rows.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">Žádné úkoly k zobrazení.</Card>
        ) : (
          <div className="grid gap-3">
            {visible.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{r.title}</h3>
                      <Badge className={cn("border-transparent", PRIORITY_STYLE[r.priority])}>
                        {TASK_PRIORITY_LABEL[r.priority] ?? r.priority}
                      </Badge>
                      <Badge className={cn("border-transparent", STATUS_STYLE[r.status])}>
                        {TASK_STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Vytvořil: {r.creator_name ?? "—"} ·{" "}
                      {new Date(r.created_at).toLocaleDateString("cs-CZ")}
                      {r.assignee_name && <> · Přiřazeno: {r.assignee_name}</>}
                      {r.due_date && <> · Termín: {new Date(r.due_date).toLocaleDateString("cs-CZ")}</>}
                    </div>
                    {r.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm">{r.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Select
                      value={r.status}
                      onValueChange={(v) => handleStatus(r.id, v as typeof TASK_STATUS[number])}
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TASK_STATUS.map((s) => (
                          <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Smazat
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function CreateTaskDialog({
  users, onClose, onCreated, createFn,
}: {
  users: Array<{ id: string; full_name: string | null; email: string | null }>;
  onClose: () => void;
  onCreated: () => void;
  createFn: (args: { data: any }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<typeof TASK_PRIORITY[number]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("__none");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title.trim()) {
      toast.error("Vyplňte název úkolu");
      return;
    }
    setSubmitting(true);
    try {
      await createFn({
        data: {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          due_date: dueDate || null,
          assignee_id: assigneeId === "__none" ? null : assigneeId,
        },
      });
      toast.success("Úkol vytvořen");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se uložit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Nový úkol</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="t-title">Název *</Label>
          <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-desc">Popis</Label>
          <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={4} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Priorita</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof TASK_PRIORITY[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_PRIORITY.map((p) => (
                  <SelectItem key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-due">Termín</Label>
            <Input id="t-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Přiřadit komu</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Bez přiřazení</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name || u.email || u.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting}>Zrušit</Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Vytvořit
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}