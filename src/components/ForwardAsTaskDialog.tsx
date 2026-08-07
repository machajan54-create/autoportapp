import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Forward } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTask, TASK_PRIORITY, TASK_PRIORITY_LABEL } from "@/lib/tasks.functions";
import { listUsers } from "@/lib/claims.functions";

type Props = {
  /** Krátký název toho, co se schválilo (např. název nákupu). */
  sourceTitle: string;
  /** Volitelné detaily zobrazené v poznámce úkolu. */
  sourceDetails?: string | null;
  /** Štítek typu schválení – „nákup", „dodavatel", „žádost o smazání". */
  sourceTypeLabel: string;
  /** Tlačítko trigger – pokud nepředáš, použije se výchozí. */
  triggerLabel?: string;
};

export function ForwardAsTaskDialog({
  sourceTitle,
  sourceDetails,
  sourceTypeLabel,
  triggerLabel = "Předat jako úkol",
}: Props) {
  const create = useServerFn(createTask);
  const fetchUsers = useServerFn(listUsers);
  const { data: users } = useQuery({
    queryKey: ["users-min"],
    queryFn: () => fetchUsers(),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`Schváleno – ${sourceTitle}`);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [priority, setPriority] = useState<(typeof TASK_PRIORITY)[number]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState(
    `Schvalovatel potvrdil ${sourceTypeLabel}: ${sourceTitle}.${
      sourceDetails ? `\n\nDetaily:\n${sourceDetails}` : ""
    }\n\nProsím o realizaci.`,
  );
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle(`Schváleno – ${sourceTitle}`);
    setAssigneeId("");
    setPriority("medium");
    setDueDate("");
    setNote(
      `Schvalovatel potvrdil ${sourceTypeLabel}: ${sourceTitle}.${
        sourceDetails ? `\n\nDetaily:\n${sourceDetails}` : ""
      }\n\nProsím o realizaci.`,
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!assigneeId) {
      toast.error("Vyberte řešitele úkolu.");
      return;
    }
    setSaving(true);
    try {
      await create({
        data: {
          title: title.trim(),
          description: note.trim() || null,
          priority,
          due_date: dueDate || null,
          assignee_id: assigneeId,
        },
      });
      toast.success("Úkol vytvořen a předán řešiteli.");
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err?.message ?? "Nepodařilo se vytvořit úkol.");
    } finally {
      setSaving(false);
    }
  }

  const approvedUsers = (users ?? []).filter((u: any) => u.approved);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Forward className="mr-1 h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Předat jako úkol</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Název úkolu *</Label>
            <Input
              required
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label>Řešitel *</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Vyberte uživatele" />
              </SelectTrigger>
              <SelectContent>
                {approvedUsers.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Priorita</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITY.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Termín</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Poznámka schvalovatele</Label>
            <Textarea
              rows={5}
              maxLength={4000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Ukládám…" : "Vytvořit úkol"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
