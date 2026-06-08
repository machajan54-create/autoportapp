import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { Switch } from "@/components/ui/switch";
import { listUsers, setUserRole } from "@/lib/claims.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const fetch = useServerFn(listUsers);
  const setRole = useServerFn(setUserRole);
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => fetch({}) });

  async function toggle(user_id: string, role: "admin" | "employee", enable: boolean) {
    try {
      await setRole({ data: { user_id, role, enable } });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AdminShell>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold">Uživatelé</h1>
        <p className="text-sm text-muted-foreground">Přidělování rolí mohou měnit pouze admini.</p>

        <div className="mt-6 overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Jméno</th>
                <th className="px-4 py-3">Zaměstnanec</th>
                <th className="px-4 py-3">Admin</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Načítám…</td></tr>
              )}
              {data?.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.full_name}</td>
                  <td className="px-4 py-3">
                    <Switch checked={u.roles.includes("employee")}
                      onCheckedChange={(v) => toggle(u.id, "employee", v)} />
                  </td>
                  <td className="px-4 py-3">
                    <Switch checked={u.roles.includes("admin")}
                      onCheckedChange={(v) => toggle(u.id, "admin", v)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AdminShell>
  );
}