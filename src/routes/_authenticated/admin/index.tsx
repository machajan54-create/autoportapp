import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listClaims } from "@/lib/claims.functions";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminList,
});

const statusLabel: Record<string, string> = {
  new: "Nová", in_progress: "V řešení", closed: "Uzavřeno",
};
const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  new: "default", in_progress: "secondary", closed: "outline",
};

function AdminList() {
  const navigate = useNavigate();
  const fetch = useServerFn(listClaims);
  const { data, isLoading } = useQuery({ queryKey: ["claims"], queryFn: () => fetch({}) });

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        rightSlot={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/users"><Users className="mr-2 h-4 w-4" />Uživatelé</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />Odhlásit
            </Button>
          </div>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold">Pojistné události</h1>
        <div className="mt-6 overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Klient</th>
                <th className="px-4 py-3">Telefon</th>
                <th className="px-4 py-3">Pojišťovna</th>
                <th className="px-4 py-3">Stav</th>
                <th className="px-4 py-3">Vytvořeno</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Načítám…</td></tr>
              )}
              {!isLoading && data?.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Zatím žádné události.</td></tr>
              )}
              {data?.map((c) => (
                <tr key={c.id} className="cursor-pointer border-t hover:bg-muted/30"
                    onClick={() => navigate({ to: "/admin/$id", params: { id: c.id } })}>
                  <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.insurer ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[c.status]}>{statusLabel[c.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("cs-CZ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}