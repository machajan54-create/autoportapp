import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { listTemplates, updateTemplate } from "@/lib/claims.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/templates")({
  component: TemplatesPage,
});

type Tpl = { id: string; key: string; title: string; body: string; updated_at: string };

function TemplatesPage() {
  const qc = useQueryClient();
  const fetch = useServerFn(listTemplates);
  const save = useServerFn(updateTemplate);
  const { data, isLoading } = useQuery({ queryKey: ["templates"], queryFn: () => fetch({}) });
  const [edits, setEdits] = useState<Record<string, { title: string; body: string }>>({});

  useEffect(() => {
    if (data) {
      const init: Record<string, { title: string; body: string }> = {};
      (data as Tpl[]).forEach((t) => (init[t.id] = { title: t.title, body: t.body }));
      setEdits(init);
    }
  }, [data]);

  async function onSave(id: string) {
    const e = edits[id];
    if (!e) return;
    try {
      await save({ data: { id, title: e.title, body: e.body } });
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Šablona uložena");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <AdminShell requireModule="users">
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold">Šablony dokumentů</h1>
        <p className="text-sm text-muted-foreground">
          Upravte text automaticky generovaných dokumentů. Použijte placeholdery jako
          <code className="mx-1 rounded bg-muted px-1">{`{{first_name}}`}</code>,
          <code className="mx-1 rounded bg-muted px-1">{`{{last_name}}`}</code>,
          <code className="mx-1 rounded bg-muted px-1">{`{{insurer}}`}</code>,
          <code className="mx-1 rounded bg-muted px-1">{`{{claim_number}}`}</code>,
          <code className="mx-1 rounded bg-muted px-1">{`{{event_at}}`}</code>,
          <code className="mx-1 rounded bg-muted px-1">{`{{location}}`}</code>,
          <code className="mx-1 rounded bg-muted px-1">{`{{phone}}`}</code>,
          <code className="mx-1 rounded bg-muted px-1">{`{{email}}`}</code>,
          <code className="mx-1 rounded bg-muted px-1">{`{{company}}`}</code>,
          <code className="mx-1 rounded bg-muted px-1">{`{{ico}}`}</code>,
          <code className="mx-1 rounded bg-muted px-1">{`{{address}}`}</code>. První řádek je nadpis
          dokumentu.
        </p>

        <div className="mt-6 space-y-6">
          {isLoading && <div className="text-sm text-muted-foreground">Načítám…</div>}
          {(data as Tpl[] | undefined)?.map((t) => {
            const e = edits[t.id] ?? { title: t.title, body: t.body };
            return (
              <div key={t.id} className="rounded-xl border bg-card p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Klíč: {t.key}
                </div>
                <div className="mt-3">
                  <Label>Název</Label>
                  <Input
                    className="mt-1"
                    value={e.title}
                    onChange={(ev) =>
                      setEdits((s) => ({ ...s, [t.id]: { ...e, title: ev.target.value } }))
                    }
                  />
                </div>
                <div className="mt-3">
                  <Label>Obsah</Label>
                  <Textarea
                    className="mt-1 font-mono text-sm"
                    rows={16}
                    value={e.body}
                    onChange={(ev) =>
                      setEdits((s) => ({ ...s, [t.id]: { ...e, body: ev.target.value } }))
                    }
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button onClick={() => onSave(t.id)}>Uložit</Button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </AdminShell>
  );
}
