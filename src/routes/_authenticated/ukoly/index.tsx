import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckSquare, Plus, Trash2, Loader2, MessageSquare, Paperclip,
  Download, Repeat, Filter as FilterIcon, X,
} from "lucide-react";
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
  listTasks, createTask, updateTask,
  TASK_PRIORITY, TASK_STATUS, TASK_PRIORITY_LABEL, TASK_STATUS_LABEL,
  TASK_RECURRENCE, TASK_RECURRENCE_LABEL,
} from "@/lib/tasks.functions";
import {
  listTaskComments, addTaskComment,
  listTaskAttachments, recordTaskAttachment,
  getTaskAttachmentUrl,
} from "@/lib/task-extras.functions";
import { cn } from "@/lib/utils";
import { RequestDeleteButton } from "@/components/RequestDeleteButton";

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

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data, isLoading } = useQuery({ queryKey: ["tasks"], queryFn: () => fetchList({}) });
  const { data: users } = useQuery({ queryKey: ["dochazka", "users"], queryFn: () => fetchUsers({}) });
  const rows = data?.rows ?? [];

  const [filter, setFilter] = useState<"open" | "mine" | "all">("open");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("__all");
  const [priorityFilter, setPriorityFilter] = useState<string>("__all");
  const [deadlineFilter, setDeadlineFilter] = useState<
    "all" | "overdue" | "today" | "week" | "none"
  >("all");

  const visible = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    return rows.filter((r) => {
      if (filter === "open" && r.status === "done") return false;
      if (filter === "mine" && r.assignee_id !== userId) return false;
      if (assigneeFilter !== "__all") {
        if (assigneeFilter === "__none" ? r.assignee_id : r.assignee_id !== assigneeFilter)
          return false;
      }
      if (priorityFilter !== "__all" && r.priority !== priorityFilter) return false;
      if (deadlineFilter !== "all") {
        if (deadlineFilter === "none" && r.due_date) return false;
        if (deadlineFilter !== "none" && !r.due_date) return false;
        if (deadlineFilter === "overdue" && r.due_date && r.due_date >= today) return false;
        if (deadlineFilter === "today" && r.due_date !== today) return false;
        if (
          deadlineFilter === "week" &&
          r.due_date &&
          (r.due_date < today || r.due_date > weekEndStr)
        )
          return false;
      }
      return true;
    });
  }, [rows, filter, userId, assigneeFilter, priorityFilter, deadlineFilter]);

  const filtersActive =
    assigneeFilter !== "__all" ||
    priorityFilter !== "__all" ||
    deadlineFilter !== "all";

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function handleStatus(id: string, status: typeof TASK_STATUS[number]) {
    try {
      await updateFn({ data: { id, status } });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se uložit");
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

        <Card className="flex flex-wrap items-end gap-3 p-3">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <FilterIcon className="h-4 w-4" /> Filtry:
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Přiřazená osoba</Label>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Všichni</SelectItem>
                <SelectItem value="__none">Bez přiřazení</SelectItem>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || u.email || u.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Priorita</Label>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Všechny</SelectItem>
                {TASK_PRIORITY.map((p) => (
                  <SelectItem key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Termín</Label>
            <Select value={deadlineFilter} onValueChange={(v) => setDeadlineFilter(v as any)}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vše</SelectItem>
                <SelectItem value="overdue">Po termínu</SelectItem>
                <SelectItem value="today">Dnes</SelectItem>
                <SelectItem value="week">Příštích 7 dní</SelectItem>
                <SelectItem value="none">Bez termínu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAssigneeFilter("__all");
                setPriorityFilter("__all");
                setDeadlineFilter("all");
              }}
            >
              <X className="mr-1 h-4 w-4" /> Vyčistit
            </Button>
          )}
        </Card>

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
                  <button
                    type="button"
                    onClick={() => setDetailId(r.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{r.title}</h3>
                      <Badge className={cn("border-transparent", PRIORITY_STYLE[r.priority])}>
                        {TASK_PRIORITY_LABEL[r.priority] ?? r.priority}
                      </Badge>
                      <Badge className={cn("border-transparent", STATUS_STYLE[r.status])}>
                        {TASK_STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                      {r.recurrence && (
                        <Badge variant="outline" className="gap-1">
                          <Repeat className="h-3 w-3" />
                          {TASK_RECURRENCE_LABEL[r.recurrence] ?? r.recurrence}
                        </Badge>
                      )}
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
                  </button>
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
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setDetailId(r.id)}>
                        <MessageSquare className="mr-1 h-4 w-4" /> Detail
                      </Button>
                      <RequestDeleteButton
                        entityType="tasks"
                        entityId={r.id}
                        entityLabel={r.title}
                        className="text-destructive hover:text-destructive"
                        title="Požádat o smazání úkolu"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <TaskDetailDialog
          taskId={detailId}
          onClose={() => setDetailId(null)}
        />
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
  const [recurrence, setRecurrence] = useState<string>("__none");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
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
          recurrence: recurrence === "__none" ? null : recurrence,
          recurrence_until: recurrence === "__none" ? null : recurrenceUntil || null,
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Opakování</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Jednorázový</SelectItem>
                {TASK_RECURRENCE.map((r) => (
                  <SelectItem key={r} value={r}>{TASK_RECURRENCE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-runtil">Opakovat do</Label>
            <Input
              id="t-runtil"
              type="date"
              value={recurrenceUntil}
              disabled={recurrence === "__none"}
              onChange={(e) => setRecurrenceUntil(e.target.value)}
            />
            {recurrence !== "__none" && (
              <p className="text-xs text-muted-foreground">
                Ponechte prázdné pro opakování bez konce.
              </p>
            )}
          </div>
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

function TaskDetailDialog({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const open = !!taskId;
  const fetchComments = useServerFn(listTaskComments);
  const addComment = useServerFn(addTaskComment);
  const fetchAttachments = useServerFn(listTaskAttachments);
  const recordAttachment = useServerFn(recordTaskAttachment);
  const getUrl = useServerFn(getTaskAttachmentUrl);

  const { data: commentsData, isLoading: cLoading } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: () => fetchComments({ data: { taskId: taskId! } }),
    enabled: open,
  });
  const { data: attachmentsData, isLoading: aLoading } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: () => fetchAttachments({ data: { taskId: taskId! } }),
    enabled: open,
  });

  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setBody("");
    }
  }, [open]);

  async function submitComment() {
    if (!body.trim() || !taskId) return;
    setPosting(true);
    try {
      await addComment({ data: { taskId, body: body.trim() } });
      setBody("");
      qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se uložit komentář");
    } finally {
      setPosting(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !taskId) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Maximální velikost přílohy je 50 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${taskId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("task-attachments")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw new Error(upErr.message);
      await recordAttachment({
        data: {
          taskId,
          file_name: file.name,
          storage_path: path,
          size_bytes: file.size,
          content_type: file.type || null,
        },
      });
      toast.success("Příloha nahrána");
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    } catch (err: any) {
      toast.error(err?.message || "Nahrání selhalo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDownload(id: string) {
    try {
      const { url } = await getUrl({ data: { id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se získat odkaz");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail úkolu</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Paperclip className="h-4 w-4" /> Přílohy
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Nahrát soubor
              </Button>
              <span className="text-xs text-muted-foreground">max 50 MB</span>
            </div>
            {aLoading ? (
              <p className="text-sm text-muted-foreground">Načítám…</p>
            ) : (attachmentsData?.rows ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Žádné přílohy.</p>
            ) : (
              <ul className="divide-y rounded border">
                {(attachmentsData?.rows ?? []).map((a: any) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 p-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{a.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.uploader_name ?? "—"} ·{" "}
                        {(a.size_bytes / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(a.id)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <RequestDeleteButton
                      entityType="task_attachments"
                      entityId={a.id}
                      entityLabel={a.file_name}
                      className="text-destructive hover:text-destructive"
                      title="Požádat o smazání přílohy"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" /> Komentáře
            </div>
            {cLoading ? (
              <p className="text-sm text-muted-foreground">Načítám…</p>
            ) : (commentsData?.rows ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Žádné komentáře.</p>
            ) : (
              <ul className="space-y-2">
                {(commentsData?.rows ?? []).map((c: any) => (
                  <li key={c.id} className="rounded border bg-muted/30 p-2 text-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {c.author_name ?? "—"} ·{" "}
                        {new Date(c.created_at).toLocaleString("cs-CZ")}
                      </span>
                      <RequestDeleteButton
                        entityType="task_comments"
                        entityId={c.id}
                        entityLabel={c.body?.slice(0, 60)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        title="Požádat o smazání komentáře"
                      >
                        <Trash2 className="h-3 w-3" />
                      </RequestDeleteButton>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Napsat komentář…"
                rows={3}
                maxLength={4000}
              />
              <div className="flex justify-end">
                <Button onClick={submitComment} disabled={posting || !body.trim()}>
                  {posting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Odeslat
                </Button>
              </div>
            </div>
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zavřít</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}