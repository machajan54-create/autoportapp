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
import { UserPlus } from "lucide-react";
import {
  listUsers,
  setUserRole,
  setUserModule,
  setUserApproved,
  adminCreateUser,
} from "@/lib/claims.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

type ModuleKey = "claims" | "vykupy" | "vykupy_external" | "users" | "approvals" | "dashboard" | "dochazka";

const MODULE_LIST: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "claims", label: "Zakázky" },
  { key: "vykupy", label: "Ojeté vozy" },
  { key: "vykupy_external", label: "Ojeté vozy – jen externí nacenění" },
  { key: "dochazka", label: "Docházka" },
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
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => fetch({}) });
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "employee" as "employee" | "admin",
  });

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

  return (
    <AdminShell requireModule="users">
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Uživatelé a přístupy</h1>
            <p className="text-sm text-muted-foreground">
              Super admin (role <b>Admin</b>) má automaticky přístup ke všem modulům.
              Ostatním uživatelům přidělte konkrétní moduly.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
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
            return (
              <div key={u.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {u.email}
                      {pending && (
                        <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          Čeká na schválení
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
      </main>
    </AdminShell>
  );
}