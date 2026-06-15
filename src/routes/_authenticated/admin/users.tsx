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

        <div className="mt-6 space-y-3">
          {isLoading && (
            <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
              Načítám…
            </div>
          )}
          {data?.map((u) => {
            const isAdmin = u.roles.includes("admin");
            const mods = u.modules ?? [];
            const pending = !u.approved && !isAdmin;
            const banned = !!(u as any).banned;
            return (
              <div key={u.id} className={`rounded-xl border bg-card p-4 ${banned ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {u.email}
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
                    <div className="text-xs text-muted-foreground">{u.full_name}</div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {!isAdmin && (
                      <label className="flex items-center gap-2">
                        Schváleno
                        <Switch
                          checked={!!u.approved}
                          onCheckedChange={(v) => approve(u.id, v)}
                        />
                      </label>
                    )}
                    <label className="flex items-center gap-2" title="Aktivní účet (může se přihlásit)">
                      <Power className="h-3.5 w-3.5" />
                      <Switch
                        checked={!banned}
                        onCheckedChange={(v) => toggleActive(u.id, v)}
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      Zaměstnanec
                      <Switch
                        checked={u.roles.includes("employee")}
                        onCheckedChange={(v) => toggle(u.id, "employee", v)}
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      Super admin
                      <Switch
                        checked={isAdmin}
                        onCheckedChange={(v) => toggle(u.id, "admin", v)}
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPwd({ id: u.id, email: u.email ?? "" })}
                    >
                      <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Heslo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setWelcomeUser({ id: u.id, email: u.email ?? "" });
                        setWelcomePwd("");
                        setWelcomeNote("");
                      }}
                      title="Zaslat informační e-mail o založení účtu"
                    >
                      <Mail className="mr-1.5 h-3.5 w-3.5" /> Info e-mail
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeUser(u.id, u.email ?? "")}
                      title="Smazat uživatele"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 border-t pt-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Přístupy do modulů
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {MODULE_LIST.map((m) => (
                      <label key={m.key} className="flex items-center gap-2">
                        <Switch
                          checked={isAdmin || mods.includes(m.key)}
                          disabled={isAdmin}
                          onCheckedChange={(v) => toggleMod(u.id, m.key, v)}
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                  {isAdmin && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Super admin má přístup ke všem modulům automaticky.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

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