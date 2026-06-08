import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { Switch } from "@/components/ui/switch";
import { listUsers, setUserRole, setUserModule } from "@/lib/claims.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const fetch = useServerFn(listUsers);
  const setRole = useServerFn(setUserRole);
  const setMod = useServerFn(setUserModule);
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => fetch({}) });

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
    module: "claims" | "vykupy" | "users",
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

  return (
    <AdminShell requireModule="users">
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold">Uživatelé a přístupy</h1>
        <p className="text-sm text-muted-foreground">
          Super admin (role <b>Admin</b>) má automaticky přístup ke všem modulům.
          Ostatním uživatelům přidělte konkrétní moduly.
        </p>

        <div className="mt-6 space-y-3">
          {isLoading && (
            <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
              Načítám…
            </div>
          )}
          {data?.map((u) => {
            const isAdmin = u.roles.includes("admin");
            const mods = u.modules ?? [];
            return (
              <div key={u.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.full_name}</div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
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
                    {(
                      [
                        { key: "claims", label: "Zakázky" },
                        { key: "vykupy", label: "Ojeté vozy" },
                        { key: "users", label: "Uživatelé" },
                      ] as const
                    ).map((m) => (
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