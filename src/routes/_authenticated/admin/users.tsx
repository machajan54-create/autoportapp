import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, KeyRound, Copy, Trash2, Power, Mail, Search, Shield, UserCheck, Users as UsersIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  listUsers,
  setUserRole,
  setUserModule,
  setUserApproved,
  adminCreateUser,
  adminSetUserPassword,
  adminSetUserActive,
  adminDeleteUser,
  adminSendWelcomeEmail,
} from "@/lib/claims.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

type ModuleKey = "claims" | "vykupy" | "vykupy_external" | "users" | "approvals" | "dashboard" | "dochazka" | "defects" | "deals" | "logbook" | "tasks";

const MODULE_LIST: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "claims", label: "Zakázky" },
  { key: "vykupy", label: "Ojeté vozy" },
  { key: "vykupy_external", label: "Ojeté vozy – jen externí nacenění" },
  { key: "dochazka", label: "Docházka" },
  { key: "defects", label: "Závady" },
  { key: "deals", label: "Obchodní případy" },
  { key: "logbook", label: "Kniha jízd" },
  { key: "tasks", label: "Úkoly" },
  { key: "approvals", label: "Schvalování" },
  { key: "users", label: "Uživatelé" },
];

function UsersPage() {
  const qc = useQueryClient();
  const fetch = useServerFn(listUsers);
  const setRole = useServerFn(setUserRole);
  const setMod = useServerFn(setUserModule);
  const setApproved = useServerFn(setUserApproved);
  const createUser = useServerFn(adminCreateUser);
  const setPwd = useServerFn(adminSetUserPassword);
  const setActive = useServerFn(adminSetUserActive);
  const deleteUser = useServerFn(adminDeleteUser);
  const sendWelcome = useServerFn(adminSendWelcomeEmail);
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => fetch({}) });
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pwdUser, setPwdUser] = useState<{ id: string; email: string } | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdGenerated, setPwdGenerated] = useState<string | null>(null);
  const [welcomeUser, setWelcomeUser] = useState<{ id: string; email: string } | null>(null);
  const [welcomePwd, setWelcomePwd] = useState("");
  const [welcomeNote, setWelcomeNote] = useState("");
  const [welcomeBusy, setWelcomeBusy] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "employee" as "employee" | "admin",
  });
  const [search, setSearch] = useState("");

  async function toggle(user_id: string, role: "admin" | "employee", enable: boolean) {
    try {
      await setRole({ data: { user_id, role, enable } });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["my-access"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleMod(
    user_id: string,
    module: ModuleKey,
    enable: boolean,
  ) {
    try {
      await setMod({ data: { user_id, module, enable } });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["my-access"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function approve(user_id: string, approved: boolean) {
    try {
      await setApproved({ data: { user_id, approved } });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(approved ? "Účet schválen" : "Schválení odebráno");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleActive(user_id: string, active: boolean) {
    try {
      await setActive({ data: { user_id, active } });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(active ? "Uživatel aktivován" : "Uživatel deaktivován");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeUser(user_id: string, email: string) {
    if (!confirm(`Opravdu trvale smazat uživatele ${email}? Tato akce je nevratná.`)) return;
    try {
      await deleteUser({ data: { user_id } });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Uživatel smazán");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function submitWelcome() {
    if (!welcomeUser) return;
    setWelcomeBusy(true);
    try {
      await sendWelcome({
        data: {
          user_id: welcomeUser.id,
          password: welcomePwd.trim() || undefined,
          note: welcomeNote.trim() || undefined,
        },
      });
      toast.success("Informační e-mail odeslán");
      setWelcomeUser(null);
      setWelcomePwd("");
      setWelcomeNote("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWelcomeBusy(false);
    }
  }

  async function submitNewUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createUser({
        data: {
          email: newUser.email.trim(),
          password: newUser.password,
          full_name: newUser.full_name.trim(),
          role: newUser.role,
          approved: true,
        },
      });
      toast.success("Uživatel vytvořen");
      setCreateOpen(false);
      setNewUser({ email: "", password: "", full_name: "", role: "employee" });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function openPwd(u: { id: string; email: string }) {
    setPwdUser(u);
    setPwdValue("");
    setPwdGenerated(null);
  }

  async function handleSetPwd(generate: boolean) {
    if (!pwdUser) return;
    setPwdBusy(true);
    try {
      const res = await setPwd({
        data: generate
          ? { user_id: pwdUser.id, generate: true }
          : { user_id: pwdUser.id, password: pwdValue, generate: false },
      });
      if (generate) {
        setPwdGenerated(res.password);
        toast.success("Vygenerováno nové heslo");
      } else {
        toast.success("Heslo změněno");
        setPwdUser(null);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <AdminShell requireModule="users">
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Administrace
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Uživatelé a přístupy</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Super admin (role <b>Admin</b>) má automaticky přístup ke všem modulům.
              Ostatním uživatelům přidělte konkrétní moduly.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-1.5 h-4 w-4" /> Vytvořit uživatele
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nový uživatel</DialogTitle>
              </DialogHeader>
              <form onSubmit={submitNewUser} className="space-y-3">
                <div>
                  <Label>Celé jméno *</Label>
                  <Input
                    required
                    maxLength={200}
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    required
                    maxLength={255}
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Heslo (min. 8 znaků) *</Label>
                  <Input
                    type="text"
                    required
                    minLength={8}
                    maxLength={128}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newUser.role === "admin"}
                      onChange={(e) =>
                        setNewUser({ ...newUser, role: e.target.checked ? "admin" : "employee" })
                      }
                    />
                    Vytvořit jako super admina
                  </Label>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Vytvářím…" : "Vytvořit"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {(() => {
          const all = data ?? [];
          const total = all.length;
          const pendingCnt = all.filter((u) => !u.approved && !u.roles.includes("admin")).length;
          const adminsCnt = all.filter((u) => u.roles.includes("admin")).length;
          const activeCnt = all.filter((u) => !(u as any).banned).length;
          const q = search.trim().toLowerCase();
          const rows = q
            ? all.filter((u) => {
                const hay = `${u.email ?? ""} ${u.full_name ?? ""}`.toLowerCase();
                return hay.includes(q);
              })
            : all;
          return (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Celkem účtů" value={total} icon={<UsersIcon className="h-4 w-4" />} tint="bg-muted text-foreground" />
                <StatTile label="Aktivních" value={activeCnt} icon={<UserCheck className="h-4 w-4" />} tint="bg-emerald-100 text-emerald-700" />
                <StatTile label="Super adminů" value={adminsCnt} icon={<Shield className="h-4 w-4" />} tint="bg-primary/10 text-primary" />
                <StatTile label="Čeká na schválení" value={pendingCnt} icon={<AlertCircle className="h-4 w-4" />} tint="bg-amber-100 text-amber-800" />
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border bg-card p-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Hledat podle e-mailu nebo jména…"
                    className="h-9 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
                  />
                </div>
                <span className="px-2 text-xs text-muted-foreground">{rows.length} z {total}</span>
              </div>

              <div className="mt-4 space-y-3">
                {isLoading && (
                  <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
                    Načítám…
                  </div>
                )}
                {!isLoading && rows.length === 0 && (
                  <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                    Žádní uživatelé neodpovídají hledání.
                  </div>
                )}
                {rows.map((u) => {
                  const isAdmin = u.roles.includes("admin");
                  const mods = u.modules ?? [];
                  const pending = !u.approved && !isAdmin;
                  const banned = !!(u as any).banned;
                  const initials = getInitials(u.full_name, u.email);
                  return (
                    <div
                      key={u.id}
                      className={cn(
                        "rounded-xl border bg-card transition hover:border-primary/40 hover:shadow-sm",
                        banned && "opacity-60",
                      )}
                    >
                      <div className="flex flex-wrap items-start gap-4 p-4 md:p-5">
                        <div
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                            isAdmin
                              ? "bg-primary/10 text-primary ring-2 ring-primary/20"
                              : "bg-muted text-foreground",
                          )}
                        >
                          {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold">{u.full_name || u.email}</span>
                            {isAdmin && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                <Shield className="h-3 w-3" /> Super admin
                              </span>
                            )}
                            {pending && (
                              <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                                Čeká na schválení
                              </span>
                            )}
                            {banned && (
                              <span className="rounded-md border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-900">
                                Deaktivován
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-sm text-muted-foreground">{u.email}</div>
                        </div>

                        <div className="flex items-center gap-1">
                          <IconAction
                            label="Změnit heslo"
                            onClick={() => openPwd({ id: u.id, email: u.email ?? "" })}
                          >
                            <KeyRound className="h-4 w-4" />
                          </IconAction>
                          <IconAction
                            label="Odeslat informační e-mail"
                            onClick={() => {
                              setWelcomeUser({ id: u.id, email: u.email ?? "" });
                              setWelcomePwd("");
                              setWelcomeNote("");
                            }}
                          >
                            <Mail className="h-4 w-4" />
                          </IconAction>
                          <IconAction
                            label="Smazat uživatele"
                            destructive
                            onClick={() => removeUser(u.id, u.email ?? "")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconAction>
                        </div>
                      </div>

                      <div className="grid gap-4 border-t bg-muted/30 p-4 md:grid-cols-[260px_1fr] md:p-5">
                        <div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Stav účtu
                          </div>
                          <div className="space-y-2 rounded-lg border bg-card p-3 text-sm">
                            <ToggleRow
                              icon={<Power className="h-3.5 w-3.5" />}
                              label="Aktivní"
                              hint="Může se přihlásit"
                              checked={!banned}
                              onChange={(v) => toggleActive(u.id, v)}
                            />
                            {!isAdmin && (
                              <ToggleRow
                                icon={<UserCheck className="h-3.5 w-3.5" />}
                                label="Schváleno"
                                hint="Účet je ověřen adminem"
                                checked={!!u.approved}
                                onChange={(v) => approve(u.id, v)}
                              />
                            )}
                            <ToggleRow
                              icon={<UsersIcon className="h-3.5 w-3.5" />}
                              label="Zaměstnanec"
                              hint="Role pro běžné akce"
                              checked={u.roles.includes("employee")}
                              onChange={(v) => toggle(u.id, "employee", v)}
                            />
                            <ToggleRow
                              icon={<Shield className="h-3.5 w-3.5" />}
                              label="Super admin"
                              hint="Plný přístup ke všemu"
                              checked={isAdmin}
                              onChange={(v) => toggle(u.id, "admin", v)}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Přístupy do modulů
                            </div>
                            {!isAdmin && (
                              <span className="text-xs text-muted-foreground">
                                {mods.length} / {MODULE_LIST.length}
                              </span>
                            )}
                          </div>
                          {isAdmin ? (
                            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-3 text-sm text-primary">
                              Super admin má přístup ke všem modulům automaticky.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-1.5 rounded-lg border bg-card p-2 sm:grid-cols-2 lg:grid-cols-3">
                              {MODULE_LIST.map((m) => {
                                const on = mods.includes(m.key);
                                return (
                                  <label
                                    key={m.key}
                                    className={cn(
                                      "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition",
                                      on ? "bg-primary/5 text-foreground" : "hover:bg-muted/60",
                                    )}
                                  >
                                    <span className="truncate">{m.label}</span>
                                    <Switch
                                      checked={on}
                                      onCheckedChange={(v) => toggleMod(u.id, m.key, v)}
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        <Dialog
          open={!!pwdUser}
          onOpenChange={(o) => {
            if (!o) {
              setPwdUser(null);
              setPwdGenerated(null);
              setPwdValue("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Heslo · {pwdUser?.email}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Aktuální heslo nelze zobrazit – je v databázi uložené jako nevratný hash.
              Můžete nastavit nové, nebo vygenerovat náhodné.
            </p>
            {pwdGenerated ? (
              <div className="rounded-md border bg-amber-50 p-3">
                <div className="mb-1 text-xs font-medium text-amber-900">
                  Nové heslo (zobrazeno pouze jednou – uložte si ho):
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-white px-2 py-1.5 font-mono text-sm">
                    {pwdGenerated}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(pwdGenerated!);
                      toast.success("Zkopírováno");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Nové heslo (min. 8 znaků)</Label>
                <Input
                  type="text"
                  minLength={8}
                  maxLength={128}
                  value={pwdValue}
                  onChange={(e) => setPwdValue(e.target.value)}
                  placeholder="Zadej nové heslo…"
                />
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              {pwdGenerated ? (
                <Button onClick={() => setPwdUser(null)}>Hotovo</Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={pwdBusy}
                    onClick={() => handleSetPwd(true)}
                  >
                    Vygenerovat náhodné
                  </Button>
                  <Button
                    disabled={pwdBusy || pwdValue.length < 8}
                    onClick={() => handleSetPwd(false)}
                  >
                    {pwdBusy ? "Ukládám…" : "Nastavit heslo"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!welcomeUser}
          onOpenChange={(o) => {
            if (!o) {
              setWelcomeUser(null);
              setWelcomePwd("");
              setWelcomeNote("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Informační e-mail · {welcomeUser?.email}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Odešle uživateli uvítací e-mail s informací o založení účtu a
              odkazem na přihlášení. Pokud chcete v e-mailu poslat i heslo, vyplňte
              jej níže (jinak se ho v e-mailu uvedeno není).
            </p>
            <div className="space-y-2">
              <Label>Heslo (volitelné)</Label>
              <Input
                type="text"
                maxLength={128}
                value={welcomePwd}
                onChange={(e) => setWelcomePwd(e.target.value)}
                placeholder="Ponechte prázdné pro neuvedení hesla"
              />
            </div>
            <div className="space-y-2">
              <Label>Poznámka (volitelné)</Label>
              <Textarea
                rows={3}
                maxLength={2000}
                value={welcomeNote}
                onChange={(e) => setWelcomeNote(e.target.value)}
                placeholder="Doplňující informace pro uživatele…"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWelcomeUser(null)} disabled={welcomeBusy}>
                Zrušit
              </Button>
              <Button onClick={submitWelcome} disabled={welcomeBusy}>
                {welcomeBusy ? "Odesílám…" : "Odeslat e-mail"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </AdminShell>
  );
}