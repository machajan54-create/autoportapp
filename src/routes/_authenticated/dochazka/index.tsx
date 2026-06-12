import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Clock, Plus, Pencil, Trash2, Download, Check, X, BellOff, BellRing,
  ExternalLink, Users as UsersIcon, CalendarClock, BarChart3, PalmtreeIcon, Bell,
  CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  listEmployees, upsertEmployee, deleteEmployee,
  listShifts, upsertShift, deleteShift,
  listRecords, upsertRecord, deleteRecord,
  listAbsences, upsertAbsence, resolveAbsence, deleteAbsence,
  listNotifications, markNotificationRead, markAllNotificationsRead,
  getDochazkaSettings, updateDochazkaSettings,
  getMonthCalendar, listResolvers,
} from "@/lib/dochazka.functions";
import {
  ABSENCE_TYPES, ABSENCE_TYPE_LABEL, SHIFT_COLORS, AVATAR_COLORS,
  avatarClasses, shiftClasses, initials, formatTime, formatDate, formatHours, todayISODate,
} from "@/lib/dochazka";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dochazka/")({
  component: DochazkaPage,
});

function DochazkaPage() {
  // Realtime: refetch when terminal/admin activity changes data
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("dochazka-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => {
        qc.invalidateQueries({ queryKey: ["dochazka"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_absences" }, () => {
        qc.invalidateQueries({ queryKey: ["dochazka"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["dochazka", "notifications"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <AdminShell requireModule={["dochazka" as any]}>
      <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Divize Provoz
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Clock className="h-7 w-7 text-sky-500" />
            Docházka
          </h1>
          <Button asChild variant="outline">
            <Link to="/terminal" target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" /> Otevřít terminál (kiosk)
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="stats" className="mt-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="stats"><BarChart3 className="mr-1 h-4 w-4" />Statistiky</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarDays className="mr-1 h-4 w-4" />Kalendář</TabsTrigger>
            <TabsTrigger value="employees"><UsersIcon className="mr-1 h-4 w-4" />Zaměstnanci</TabsTrigger>
            <TabsTrigger value="shifts"><CalendarClock className="mr-1 h-4 w-4" />Směny</TabsTrigger>
            <TabsTrigger value="records">Záznamy</TabsTrigger>
            <TabsTrigger value="absences"><PalmtreeIcon className="mr-1 h-4 w-4" />Absence</TabsTrigger>
            <TabsTrigger value="alerts"><Bell className="mr-1 h-4 w-4" />Upozornění</TabsTrigger>
            <TabsTrigger value="export"><Download className="mr-1 h-4 w-4" />Export</TabsTrigger>
          </TabsList>

          <TabsContent value="stats"><StatsTab /></TabsContent>
          <TabsContent value="calendar"><CalendarTab /></TabsContent>
          <TabsContent value="employees"><EmployeesTab /></TabsContent>
          <TabsContent value="shifts"><ShiftsTab /></TabsContent>
          <TabsContent value="records"><RecordsTab /></TabsContent>
          <TabsContent value="absences"><AbsencesTab /></TabsContent>
          <TabsContent value="alerts"><AlertsTab /></TabsContent>
          <TabsContent value="export"><ExportTab /></TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}

// ============= Stats =============
function StatsTab() {
  const fetchEmp = useServerFn(listEmployees);
  const fetchRec = useServerFn(listRecords);
  const fetchAbs = useServerFn(listAbsences);
  const { data: employees } = useQuery({ queryKey: ["dochazka", "employees"], queryFn: () => fetchEmp({}) });
  const { data: records } = useQuery({ queryKey: ["dochazka", "records"], queryFn: () => fetchRec({}) });
  const { data: absences } = useQuery({ queryKey: ["dochazka", "absences"], queryFn: () => fetchAbs({}) });

  const today = todayISODate();
  const monthPrefix = today.slice(0, 7);

  const stats = useMemo(() => {
    const recs = records ?? [];
    const monthly = recs.filter((r) => r.date.startsWith(monthPrefix));
    const totalHours = monthly.reduce((sum, r) => sum + Number(r.hours_worked ?? 0), 0);
    const openToday = recs.filter((r) => r.date === today && !r.check_out);
    const closedToday = recs.filter((r) => r.date === today && r.check_out);
    const pendingAbs = (absences ?? []).filter((a) => a.status === "pending").length;
    const hoursByEmp = new Map<string, number>();
    monthly.forEach((r) => {
      hoursByEmp.set(r.employee_id, (hoursByEmp.get(r.employee_id) ?? 0) + Number(r.hours_worked ?? 0));
    });
    const ranking = Array.from(hoursByEmp.entries())
      .map(([id, hours]) => {
        const emp = employees?.find((e) => e.id === id);
        return { id, name: emp?.name ?? "Neznámý", hours };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
    return { totalHours, openToday: openToday.length, closedToday: closedToday.length, pendingAbs, ranking };
  }, [records, employees, absences, monthPrefix, today]);

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Aktuálně v práci" value={stats.openToday} accent="text-emerald-600" />
        <StatCard label="Dokončeno dnes" value={stats.closedToday} accent="text-sky-600" />
        <StatCard label="Odpracováno (měsíc)" value={`${stats.totalHours.toFixed(1)} h`} accent="text-purple-600" />
        <StatCard label="Čekající absence" value={stats.pendingAbs} accent="text-amber-600" />
      </div>
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Top 10 zaměstnanců — odpracované hodiny ({monthPrefix})</h3>
        {stats.ranking.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Zatím žádné záznamy v aktuálním měsíci.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {stats.ranking.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3">
                <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}.</span>
                <span className="flex-1 truncate text-sm font-medium">{r.name}</span>
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-sky-500"
                    style={{ width: `${Math.min(100, (r.hours / Math.max(...stats.ranking.map((x) => x.hours))) * 100)}%` }}
                  />
                </div>
                <span className="w-20 text-right font-mono text-sm tabular-nums">{r.hours.toFixed(1)} h</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", accent)}>{value}</p>
    </Card>
  );
}

// ============= Employees =============
function EmployeesTab() {
  const qc = useQueryClient();
  const fetchEmp = useServerFn(listEmployees);
  const upsert = useServerFn(upsertEmployee);
  const del = useServerFn(deleteEmployee);
  const fetchResolvers = useServerFn(listResolvers);
  const { data, isLoading } = useQuery({ queryKey: ["dochazka", "employees"], queryFn: () => fetchEmp({}) });
  const { data: users } = useQuery({ queryKey: ["dochazka", "users"], queryFn: () => fetchResolvers({}) });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  function openNew() {
    setEdit({ name: "", role: "", pin: "", avatar_color: "slate", active: true, can_approve_absences: false, user_id: null });
    setOpen(true);
  }
  function openEdit(emp: any) {
    setEdit({ ...emp, pin: "", user_id: emp.user_id ?? null });
    setOpen(true);
  }
  async function save() {
    try {
      await upsert({ data: edit });
      toast.success("Uloženo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["dochazka", "employees"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Chyba");
    }
  }
  async function onDelete(id: string) {
    if (!confirm("Opravdu smazat tohoto zaměstnance?")) return;
    try {
      await del({ data: { id } });
      toast.success("Smazáno");
      qc.invalidateQueries({ queryKey: ["dochazka", "employees"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Chyba");
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nový zaměstnanec</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Jméno</TableHead>
              <TableHead>Pozice</TableHead>
              <TableHead>PIN</TableHead>
              <TableHead>Schvaluje</TableHead>
              <TableHead>Aktivní</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Načítám…</TableCell></TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Žádní zaměstnanci.</TableCell></TableRow>
            ) : (data ?? []).map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full border font-semibold", avatarClasses(e.avatar_color))}>
                    {initials(e.name)}
                  </span>
                </TableCell>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell className="text-muted-foreground">{e.role || "—"}</TableCell>
                <TableCell className="font-mono text-xs">••••</TableCell>
                <TableCell>{e.can_approve_absences ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground" />}</TableCell>
                <TableCell>{e.active ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Aktivní</Badge> : <Badge variant="outline">Neaktivní</Badge>}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Upravit zaměstnance" : "Nový zaměstnanec"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid gap-2"><Label>Jméno</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Pozice</Label><Input value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} /></div>
              <div className="grid gap-2"><Label>PIN (4–8 číslic)</Label><Input value={edit.pin} onChange={(e) => setEdit({ ...edit, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} /></div>
              <div className="grid gap-2">
                <Label>Barva avatara</Label>
                <div className="flex gap-2">
                  {AVATAR_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setEdit({ ...edit, avatar_color: c })} className={cn("h-9 w-9 rounded-full border-2", avatarClasses(c), edit.avatar_color === c ? "ring-2 ring-primary ring-offset-2" : "")}>
                      {edit.avatar_color === c && <Check className="mx-auto h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between"><Label>Může schvalovat absence</Label><Switch checked={edit.can_approve_absences} onCheckedChange={(v) => setEdit({ ...edit, can_approve_absences: v })} /></div>
              <div className="flex items-center justify-between"><Label>Aktivní</Label><Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /></div>
              <div className="grid gap-2">
                <Label>Přiřazený uživatel (přihlášení do aplikace)</Label>
                <Select
                  value={edit.user_id ?? "__none"}
                  onValueChange={(v) => setEdit({ ...edit, user_id: v === "__none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Bez přiřazení" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Bez přiřazení (jen kiosk)</SelectItem>
                    {(users ?? []).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email || u.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Po přiřazení vidí tento zaměstnanec v Docházce jen své vlastní záznamy a žádosti.
                </p>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button><Button onClick={save}>Uložit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= Shifts =============
function ShiftsTab() {
  const qc = useQueryClient();
  const fetchS = useServerFn(listShifts);
  const upsert = useServerFn(upsertShift);
  const del = useServerFn(deleteShift);
  const { data } = useQuery({ queryKey: ["dochazka", "shifts"], queryFn: () => fetchS({}) });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  function openNew() { setEdit({ name: "", start_time: "08:00", end_time: "16:30", color: "sky" }); setOpen(true); }
  function openEdit(s: any) { setEdit({ ...s, start_time: (s.start_time as string).slice(0, 5), end_time: (s.end_time as string).slice(0, 5) }); setOpen(true); }
  async function save() {
    try {
      await upsert({ data: edit });
      toast.success("Uloženo"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["dochazka", "shifts"] });
    } catch (e: any) { toast.error(e?.message ?? "Chyba"); }
  }
  async function onDelete(id: string) {
    if (!confirm("Smazat směnu?")) return;
    try { await del({ data: { id } }); toast.success("Smazáno"); qc.invalidateQueries({ queryKey: ["dochazka", "shifts"] }); }
    catch (e: any) { toast.error(e?.message ?? "Chyba"); }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nová směna</Button></div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <Badge className={cn("border", shiftClasses(s.color))}>{s.name}</Badge>
                <p className="mt-2 font-mono text-xl tabular-nums">
                  {(s.start_time as string).slice(0, 5)} – {(s.end_time as string).slice(0, 5)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Zatím žádné směny.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Upravit směnu" : "Nová směna"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid gap-2"><Label>Název</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Od</Label><Input type="time" value={edit.start_time} onChange={(e) => setEdit({ ...edit, start_time: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Do</Label><Input type="time" value={edit.end_time} onChange={(e) => setEdit({ ...edit, end_time: e.target.value })} /></div>
              </div>
              <div className="grid gap-2">
                <Label>Barva</Label>
                <div className="flex gap-2">
                  {SHIFT_COLORS.map((c) => (
                    <button key={c.value} type="button" onClick={() => setEdit({ ...edit, color: c.value })} className={cn("rounded-full border-2 px-3 py-1 text-xs font-medium", c.className, edit.color === c.value ? "ring-2 ring-primary ring-offset-2" : "")}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button><Button onClick={save}>Uložit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= Records =============
function RecordsTab() {
  const qc = useQueryClient();
  const fetchR = useServerFn(listRecords);
  const fetchE = useServerFn(listEmployees);
  const fetchS = useServerFn(listShifts);
  const upsert = useServerFn(upsertRecord);
  const del = useServerFn(deleteRecord);
  const { data: records } = useQuery({ queryKey: ["dochazka", "records"], queryFn: () => fetchR({}) });
  const { data: employees } = useQuery({ queryKey: ["dochazka", "employees"], queryFn: () => fetchE({}) });
  const { data: shifts } = useQuery({ queryKey: ["dochazka", "shifts"], queryFn: () => fetchS({}) });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const empMap = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e])), [employees]);
  const shiftMap = useMemo(() => new Map((shifts ?? []).map((s) => [s.id, s])), [shifts]);

  function openNew() {
    const now = new Date();
    const iso = now.toISOString().slice(0, 16);
    setEdit({
      employee_id: employees?.[0]?.id ?? "",
      shift_id: shifts?.[0]?.id ?? null,
      date: todayISODate(),
      check_in: iso,
      check_out: "",
      break_duration: 30,
      hours_worked: 0,
      note: "",
    });
    setOpen(true);
  }
  function openEdit(r: any) {
    setEdit({
      ...r,
      check_in: r.check_in ? new Date(r.check_in).toISOString().slice(0, 16) : "",
      check_out: r.check_out ? new Date(r.check_out).toISOString().slice(0, 16) : "",
      note: r.note ?? "",
    });
    setOpen(true);
  }
  async function save() {
    try {
      const payload = {
        ...edit,
        check_in: new Date(edit.check_in).toISOString(),
        check_out: edit.check_out ? new Date(edit.check_out).toISOString() : null,
        break_duration: Number(edit.break_duration) || 0,
        hours_worked: Number(edit.hours_worked) || 0,
        shift_id: edit.shift_id || null,
      };
      if (payload.check_out && payload.check_in) {
        const ms = new Date(payload.check_out).getTime() - new Date(payload.check_in).getTime();
        const breakMs = payload.break_duration * 60_000;
        payload.hours_worked = Math.max(0, Math.round(((ms - breakMs) / 3_600_000) * 100) / 100);
      }
      await upsert({ data: payload });
      toast.success("Uloženo"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["dochazka", "records"] });
    } catch (e: any) { toast.error(e?.message ?? "Chyba"); }
  }
  async function onDelete(id: string) {
    if (!confirm("Smazat záznam?")) return;
    try { await del({ data: { id } }); toast.success("Smazáno"); qc.invalidateQueries({ queryKey: ["dochazka", "records"] }); }
    catch (e: any) { toast.error(e?.message ?? "Chyba"); }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nový záznam</Button></div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Zaměstnanec</TableHead>
              <TableHead>Směna</TableHead>
              <TableHead>Příchod</TableHead>
              <TableHead>Odchod</TableHead>
              <TableHead>Pauza</TableHead>
              <TableHead>Hodiny</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(records ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Žádné záznamy.</TableCell></TableRow>
            ) : (records ?? []).map((r) => {
              const emp = empMap.get(r.employee_id);
              const sh = r.shift_id ? shiftMap.get(r.shift_id) : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{formatDate(r.date)}</TableCell>
                  <TableCell className="font-medium">{emp?.name ?? "—"}</TableCell>
                  <TableCell>{sh ? <Badge variant="outline" className={cn("border", shiftClasses(sh.color))}>{sh.name}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="font-mono">{formatTime(r.check_in)}</TableCell>
                  <TableCell className="font-mono">{r.check_out ? formatTime(r.check_out) : <Badge variant="secondary" className="bg-amber-100 text-amber-700">v práci</Badge>}</TableCell>
                  <TableCell className="text-xs">{r.break_duration} min</TableCell>
                  <TableCell className="font-mono font-semibold">{formatHours(Number(r.hours_worked))}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Upravit záznam" : "Nový záznam"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>Zaměstnanec</Label>
                <Select value={edit.employee_id} onValueChange={(v) => setEdit({ ...edit, employee_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Směna</Label>
                <Select value={edit.shift_id ?? "_none"} onValueChange={(v) => setEdit({ ...edit, shift_id: v === "_none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="_none">Bez směny</SelectItem>{(shifts ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Datum</Label><Input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Příchod</Label><Input type="datetime-local" value={edit.check_in} onChange={(e) => setEdit({ ...edit, check_in: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Odchod</Label><Input type="datetime-local" value={edit.check_out} onChange={(e) => setEdit({ ...edit, check_out: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Pauza (min)</Label><Input type="number" min={0} value={edit.break_duration} onChange={(e) => setEdit({ ...edit, break_duration: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Hodiny (auto)</Label><Input type="number" step="0.01" value={edit.hours_worked} onChange={(e) => setEdit({ ...edit, hours_worked: e.target.value })} /></div>
              </div>
              <div className="grid gap-2"><Label>Poznámka</Label><Textarea value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button><Button onClick={save}>Uložit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= Absences =============
function AbsencesTab() {
  const qc = useQueryClient();
  const fetchA = useServerFn(listAbsences);
  const fetchE = useServerFn(listEmployees);
  const fetchR = useServerFn(listResolvers);
  const upsert = useServerFn(upsertAbsence);
  const resolve = useServerFn(resolveAbsence);
  const del = useServerFn(deleteAbsence);
  const { data: absences } = useQuery({ queryKey: ["dochazka", "absences"], queryFn: () => fetchA({}) });
  const { data: employees } = useQuery({ queryKey: ["dochazka", "employees"], queryFn: () => fetchE({}) });
  const { data: resolvers } = useQuery({ queryKey: ["dochazka", "resolvers"], queryFn: () => fetchR() });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const empMap = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e])), [employees]);
  const resolverMap = useMemo(
    () => new Map((resolvers ?? []).map((p: any) => [p.id, p.full_name || p.email])),
    [resolvers],
  );

  function openNew() {
    setEdit({
      employee_id: employees?.[0]?.id ?? "",
      type: "dovolena",
      start_date: todayISODate(),
      end_date: todayISODate(),
      note: "",
    });
    setOpen(true);
  }
  async function save() {
    try {
      await upsert({ data: edit });
      toast.success("Uloženo"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["dochazka", "absences"] });
    } catch (e: any) { toast.error(e?.message ?? "Chyba"); }
  }
  async function decide(id: string, status: "approved" | "rejected") {
    try {
      await resolve({ data: { id, status } });
      toast.success(status === "approved" ? "Schváleno" : "Zamítnuto");
      qc.invalidateQueries({ queryKey: ["dochazka", "absences"] });
    } catch (e: any) { toast.error(e?.message ?? "Chyba"); }
  }
  async function onDelete(id: string) {
    if (!confirm("Smazat?")) return;
    try { await del({ data: { id } }); toast.success("Smazáno"); qc.invalidateQueries({ queryKey: ["dochazka", "absences"] }); }
    catch (e: any) { toast.error(e?.message ?? "Chyba"); }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nová žádost</Button></div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zaměstnanec</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Od</TableHead>
              <TableHead>Do</TableHead>
              <TableHead>Poznámka</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead className="w-40"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(absences ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Žádné absence.</TableCell></TableRow>
            ) : (absences ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{empMap.get(a.employee_id)?.name ?? "—"}</TableCell>
                <TableCell>{ABSENCE_TYPE_LABEL[a.type] ?? a.type}</TableCell>
                <TableCell className="font-mono text-xs">{formatDate(a.start_date)}</TableCell>
                <TableCell className="font-mono text-xs">{formatDate(a.end_date)}</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{a.note ?? "—"}</TableCell>
                <TableCell>
                  {a.status === "pending" && <Badge variant="secondary" className="bg-amber-100 text-amber-700">Čeká</Badge>}
                  {a.status === "approved" && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Schváleno</Badge>}
                  {a.status === "rejected" && <Badge variant="secondary" className="bg-rose-100 text-rose-700">Zamítnuto</Badge>}
                {a.resolved_by && a.status !== "pending" && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {resolverMap.get(a.resolved_by) ?? "neznámý"}
                  </div>
                )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {a.status === "pending" && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => decide(a.id, "approved")} title="Schválit"><Check className="h-4 w-4 text-emerald-600" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => decide(a.id, "rejected")} title="Zamítnout"><X className="h-4 w-4 text-rose-600" /></Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => onDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nová žádost o volno</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>Zaměstnanec</Label>
                <Select value={edit.employee_id} onValueChange={(v) => setEdit({ ...edit, employee_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Typ</Label>
                <Select value={edit.type} onValueChange={(v) => setEdit({ ...edit, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ABSENCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Od</Label><Input type="date" value={edit.start_date} onChange={(e) => setEdit({ ...edit, start_date: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Do</Label><Input type="date" value={edit.end_date} onChange={(e) => setEdit({ ...edit, end_date: e.target.value })} /></div>
              </div>
              <div className="grid gap-2"><Label>Poznámka</Label><Textarea value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button><Button onClick={save}>Uložit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= Alerts (notifications + settings) =============
function AlertsTab() {
  const qc = useQueryClient();
  const fetchN = useServerFn(listNotifications);
  const mark = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const getSettings = useServerFn(getDochazkaSettings);
  const updSettings = useServerFn(updateDochazkaSettings);

  const { data: notifs } = useQuery({ queryKey: ["dochazka", "notifications"], queryFn: () => fetchN({}) });
  const { data: settings } = useQuery({ queryKey: ["dochazka", "settings"], queryFn: () => getSettings({}) });

  async function setting(field: string, value: any) {
    try {
      await updSettings({ data: { [field]: value } });
      qc.invalidateQueries({ queryKey: ["dochazka", "settings"] });
    } catch (e: any) { toast.error(e?.message ?? "Chyba"); }
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Upozornění</h3>
          <Button size="sm" variant="outline" onClick={async () => { await markAll({}); qc.invalidateQueries({ queryKey: ["dochazka", "notifications"] }); }}>
            Označit vše jako přečtené
          </Button>
        </div>
        <div className="space-y-2">
          {(notifs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Žádná upozornění.</p>
          ) : (notifs ?? []).map((n) => (
            <div key={n.id} className={cn("flex items-start gap-3 rounded-lg border p-3", n.read ? "bg-muted/30" : "bg-background")}>
              {n.read ? <BellOff className="h-4 w-4 text-muted-foreground" /> : <BellRing className="h-4 w-4 text-primary" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("cs-CZ")}</p>
              </div>
              {!n.read && (
                <Button size="sm" variant="ghost" onClick={async () => { await mark({ data: { id: n.id, read: true } }); qc.invalidateQueries({ queryKey: ["dochazka", "notifications"] }); }}>
                  Přečteno
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Nastavení</h3>
        {!settings ? <p className="text-xs text-muted-foreground">Načítám…</p> : (
          <div className="space-y-3 text-sm">
            <Row label="Upozorňovat na pozdní příchod" checked={settings.notify_employee_late} onChange={(v) => setting("notify_employee_late", v)} />
            <Row label="Upozorňovat manažera na absenci" checked={settings.notify_manager_no_show} onChange={(v) => setting("notify_manager_no_show", v)} />
            <Row label="Žádosti o absenci – schvalování" checked={settings.notify_manager_absence_pending} onChange={(v) => setting("notify_manager_absence_pending", v)} />
            <Row label="Informovat zaměstnance o vyřešení" checked={settings.notify_employee_absence_resolved} onChange={(v) => setting("notify_employee_absence_resolved", v)} />
            <div className="grid gap-1">
              <Label className="text-xs">Tolerance pozdního příchodu (min)</Label>
              <Input type="number" value={settings.late_arrival_buffer_minutes} onChange={(e) => setting("late_arrival_buffer_minutes", Number(e.target.value))} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Prefix zpráv</Label>
              <Input value={settings.custom_message_prefix} onChange={(e) => setting("custom_message_prefix", e.target.value)} />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ============= Export =============
function ExportTab() {
  const fetchR = useServerFn(listRecords);
  const fetchE = useServerFn(listEmployees);
  const fetchS = useServerFn(listShifts);
  const { data: records } = useQuery({ queryKey: ["dochazka", "records"], queryFn: () => fetchR({}) });
  const { data: employees } = useQuery({ queryKey: ["dochazka", "employees"], queryFn: () => fetchE({}) });
  const { data: shifts } = useQuery({ queryKey: ["dochazka", "shifts"], queryFn: () => fetchS({}) });
  const [month, setMonth] = useState(() => todayISODate().slice(0, 7));

  const filtered = useMemo(() => (records ?? []).filter((r) => r.date.startsWith(month)), [records, month]);

  function exportCSV() {
    const empMap = new Map((employees ?? []).map((e) => [e.id, e.name]));
    const shiftMap = new Map((shifts ?? []).map((s) => [s.id, s.name]));
    const header = ["Datum", "Zaměstnanec", "Směna", "Příchod", "Odchod", "Pauza (min)", "Hodiny", "Poznámka"];
    const rows = filtered.map((r) => [
      r.date,
      empMap.get(r.employee_id) ?? "",
      r.shift_id ? (shiftMap.get(r.shift_id) ?? "") : "",
      r.check_in ? new Date(r.check_in).toLocaleString("cs-CZ") : "",
      r.check_out ? new Date(r.check_out).toLocaleString("cs-CZ") : "",
      String(r.break_duration ?? 0),
      String(r.hours_worked ?? 0),
      (r.note ?? "").replace(/[\r\n;]/g, " "),
    ]);
    const csv = [header, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dochazka-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalHours = filtered.reduce((s, r) => s + Number(r.hours_worked ?? 0), 0);

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Export CSV za měsíc</h3>
        <div className="mt-3 grid gap-2">
          <Label>Měsíc</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          Záznamů: <span className="font-semibold text-foreground">{filtered.length}</span> · Celkem hodin:{" "}
          <span className="font-semibold text-foreground">{totalHours.toFixed(1)}</span>
        </div>
        <Button className="mt-4 w-full" onClick={exportCSV} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Stáhnout CSV
        </Button>
      </Card>
      <Card className="p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Tipy</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Export obsahuje BOM, otevře se správně v Excelu.</li>
          <li>Oddělovač je středník (cs-CZ standard).</li>
          <li>Pro reporting po zaměstnanci použijte filtr v Excelu.</li>
        </ul>
      </Card>
    </div>
  );
}

// ============= Calendar =============
function CalendarTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1..12

  const fetchCal = useServerFn(getMonthCalendar);
  const { data, isLoading } = useQuery({
    queryKey: ["dochazka", "calendar", year, month],
    queryFn: () => fetchCal({ data: { year, month } }),
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function prev() {
    if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1);
  }
  function next() {
    if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1);
  }

  // Map[empId][day] = { state, hours }
  const grid = useMemo(() => {
    const m = new Map<string, Map<number, { state: string; hours?: number; type?: string }>>();
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    (data?.employees ?? []).forEach((e: any) => m.set(e.id, new Map()));
    (data?.records ?? []).forEach((r: any) => {
      if (!r.date.startsWith(monthStr)) return;
      const day = Number(r.date.slice(8, 10));
      const emp = m.get(r.employee_id);
      if (!emp) return;
      const existing = emp.get(day);
      const hours = (existing?.hours ?? 0) + Number(r.hours_worked ?? 0);
      const state = r.check_out ? "worked" : "in";
      emp.set(day, { state: existing?.state === "in" ? "in" : state, hours });
    });
    (data?.absences ?? []).forEach((a: any) => {
      const sd = new Date(a.start_date);
      const ed = new Date(a.end_date);
      for (let d = new Date(sd); d <= ed; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
        const day = d.getDate();
        const emp = m.get(a.employee_id);
        if (!emp) continue;
        const stateName = a.status === "pending" ? "abs_pending" : a.status === "rejected" ? "abs_rejected" : `abs_${a.type}`;
        if (!emp.has(day)) emp.set(day, { state: stateName, type: a.type });
      }
    });
    return m;
  }, [data, year, month]);

  function cellClasses(s?: string) {
    if (!s) return "bg-muted/30";
    if (s === "in") return "bg-amber-200 text-amber-900";
    if (s === "worked") return "bg-emerald-200 text-emerald-900";
    if (s === "abs_pending") return "bg-slate-200 text-slate-700";
    if (s === "abs_rejected") return "bg-rose-100 text-rose-700";
    if (s.startsWith("abs_")) return "bg-sky-100 text-sky-800";
    return "bg-muted/30";
  }
  function cellLabel(s?: string) {
    if (!s) return "";
    if (s === "in") return "V";
    if (s === "worked") return "✓";
    if (s === "abs_pending") return "?";
    if (s === "abs_rejected") return "✗";
    if (s === "abs_dovolena") return "D";
    if (s === "abs_nemoc") return "N";
    if (s === "abs_lekar") return "L";
    if (s === "abs_neplacene_volno") return "V";
    return "•";
  }

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });

  return (
    <div className="mt-4 space-y-3">
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <Button size="icon" variant="outline" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-sm font-semibold capitalize">{monthName}</div>
          <Button size="icon" variant="outline" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </Card>

      <Card className="overflow-x-auto p-2">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Načítám…</p>
        ) : (data?.employees ?? []).length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Žádní zaměstnanci.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background p-2 text-left font-semibold">Zaměstnanec</th>
                {days.map((d) => {
                  const dow = new Date(year, month - 1, d).getDay();
                  const weekend = dow === 0 || dow === 6;
                  return (
                    <th key={d} className={cn("w-7 p-1 text-center font-mono", weekend && "text-rose-400")}>
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(data?.employees ?? []).map((e: any) => (
                <tr key={e.id} className="border-t">
                  <td className="sticky left-0 z-10 bg-background p-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold", avatarClasses(e.avatar_color))}>
                        {initials(e.name)}
                      </span>
                      <span className="truncate font-medium">{e.name}</span>
                    </div>
                  </td>
                  {days.map((d) => {
                    const cell = grid.get(e.id)?.get(d);
                    const dow = new Date(year, month - 1, d).getDay();
                    const weekend = dow === 0 || dow === 6;
                    return (
                      <td key={d} className="p-0.5">
                        <div
                          title={cell?.hours ? `${cell.hours.toFixed(1)} h` : cell?.state ?? ""}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded text-[10px] font-semibold",
                            cellClasses(cell?.state),
                            !cell && weekend && "bg-slate-100",
                          )}
                        >
                          {cellLabel(cell?.state)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-3 text-xs">
        <p className="mb-2 font-semibold">Legenda</p>
        <div className="flex flex-wrap gap-3 text-muted-foreground">
          <Legend cls="bg-emerald-200 text-emerald-900" label="Odpracováno (✓)" />
          <Legend cls="bg-amber-200 text-amber-900" label="V práci (V)" />
          <Legend cls="bg-sky-100 text-sky-800" label="Absence (D/N/L)" />
          <Legend cls="bg-slate-200 text-slate-700" label="Žádost čeká (?)" />
          <Legend cls="bg-rose-100 text-rose-700" label="Zamítnuto (✗)" />
        </div>
      </Card>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-4 w-4 rounded", cls)} />
      {label}
    </span>
  );
}