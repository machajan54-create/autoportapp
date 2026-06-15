import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { listEmployees, listShifts, autoFillMonth } from "@/lib/dochazka.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/dochazka")({
  component: AdminDochazkaPage,
});

function AdminDochazkaPage() {
  const qc = useQueryClient();
  const fetchE = useServerFn(listEmployees);
  const fetchS = useServerFn(listShifts);
  const fill = useServerFn(autoFillMonth);
  const { data: employees } = useQuery({ queryKey: ["dochazka", "employees"], queryFn: () => fetchE({}) });
  const { data: shifts } = useQuery({ queryKey: ["dochazka", "shifts"], queryFn: () => fetchS({}) });

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [form, setForm] = useState({
    employee_id: "",
    month: defaultMonth,
    mode: "HPP" as "HPP" | "DPP",
    hours_per_day: 8,
    total_hours: 100,
    start_hour: 8,
    break_minutes: 30,
    shift_id: "",
  });
  const [busy, setBusy] = useState(false);

  const emps = employees ?? [];
  const shs = shifts ?? [];
  const employee = emps.find((e: any) => e.id === form.employee_id);
  const empTypes: string[] = (employee?.employment_types as string[]) ?? [];
  const availableModes = empTypes.length ? empTypes : ["HPP"];

  async function submit() {
    if (!form.employee_id) { toast.error("Vyberte zaměstnance"); return; }
    const [y, m] = form.month.split("-").map(Number);
    setBusy(true);
    try {
      const r = await fill({
        data: {
          employee_id: form.employee_id,
          year: y,
          month: m,
          mode: form.mode,
          hours_per_day: form.hours_per_day,
          total_hours: form.total_hours,
          start_hour: form.start_hour,
          break_minutes: form.break_minutes,
          shift_id: form.shift_id || null,
        },
      });
      toast.success(`Vygenerováno ${r.created} dní · celkem ${r.total_hours} h${r.skipped ? ` (přeskočeno ${r.skipped})` : ""}`);
      qc.invalidateQueries({ queryKey: ["dochazka"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Chyba");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <Sparkles className="h-7 w-7 text-sky-500" />
          Automatické generování docházky
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hromadné vygenerování docházky za měsíc pro vybraného zaměstnance.
        </p>

        <Card className="mt-6 space-y-3 p-5">
          <div className="grid gap-2">
            <Label>Zaměstnanec</Label>
            <Select
              value={form.employee_id}
              onValueChange={(v) => {
                const e = emps.find((x: any) => x.id === v);
                const types = (e?.employment_types as string[]) ?? ["HPP"];
                setForm({ ...form, employee_id: v, mode: types[0] as "HPP" | "DPP" });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Vyberte…" /></SelectTrigger>
              <SelectContent>
                {emps.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {((e.employment_types as string[]) ?? ["HPP"]).join(" + ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Měsíc</Label>
              <Input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Režim</Label>
              <div className="flex gap-1">
                {(["HPP", "DPP"] as const).map((t) => {
                  const enabled = availableModes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!enabled}
                      onClick={() => setForm({ ...form, mode: t })}
                      className={cn(
                        "flex-1 rounded-md border-2 px-2 py-1.5 text-sm font-semibold transition",
                        !enabled && "cursor-not-allowed opacity-40",
                        form.mode === t
                          ? t === "DPP"
                            ? "border-violet-400 bg-violet-50 text-violet-800"
                            : "border-sky-400 bg-sky-50 text-sky-800"
                          : "border-slate-200 bg-white text-slate-600",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {form.mode === "HPP" ? (
            <div className="grid gap-2">
              <Label>Hodin na pracovní den</Label>
              <Input
                type="number" step="0.25" min="0.25" max="24"
                value={form.hours_per_day}
                onChange={(e) => setForm({ ...form, hours_per_day: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Vygeneruje záznam na každý pracovní den (po–pá) s {form.hours_per_day} h.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>Celkový počet hodin za měsíc</Label>
              <Input
                type="number" step="0.25" min="0.25" max="744"
                value={form.total_hours}
                onChange={(e) => setForm({ ...form, total_hours: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Hodiny se rovnoměrně rozprostřou mezi pracovní dny (krok 0,25 h).
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Začátek</Label>
              <Input type="number" min="0" max="23" value={form.start_hour}
                onChange={(e) => setForm({ ...form, start_hour: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label>Pauza (min)</Label>
              <Input type="number" min="0" max="240" value={form.break_minutes}
                onChange={(e) => setForm({ ...form, break_minutes: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label>Směna</Label>
              <Select value={form.shift_id || "__none"} onValueChange={(v) => setForm({ ...form, shift_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Bez směny</SelectItem>
                  {shs.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">
            Dny s již existujícím záznamem nebo schválenou/čekající absencí budou přeskočeny.
          </p>

          <div className="flex justify-end pt-2">
            <Button onClick={submit} disabled={busy}>
              <Sparkles className="mr-1 h-4 w-4" />
              {busy ? "Generuji…" : "Vygenerovat"}
            </Button>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}