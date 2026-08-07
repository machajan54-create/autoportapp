import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { listAuditLog, listAuditModules } from "@/lib/audit.functions";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
});

const MODULE_LABEL: Record<string, string> = {
  claims: "Zakázky",
  vykupy: "Ojeté vozy",
  defects: "Závady",
  dochazka: "Docházka",
  approvals: "Schvalování",
  users: "Uživatelé",
  templates: "Šablony",
  auth: "Přihlášení",
};

function AuditPage() {
  const [module, setModule] = useState<string>("");
  const [search, setSearch] = useState("");
  const fetchLog = useServerFn(listAuditLog);
  const fetchModules = useServerFn(listAuditModules);

  const { data: mods } = useQuery({
    queryKey: ["audit", "modules"],
    queryFn: () => fetchModules({}),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "log", module, search],
    queryFn: () =>
      fetchLog({ data: { module: module || null, search: search || null, limit: 300 } }),
  });

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historie důležitých akcí napříč systémem.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="w-48">
            <Select
              value={module || "__all"}
              onValueChange={(v) => setModule(v === "__all" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Modul" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Všechny moduly</SelectItem>
                {(mods?.modules ?? []).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODULE_LABEL[m] ?? m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat (akce / uživatel / objekt)…"
            className="max-w-sm"
          />
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Čas</th>
                <th className="px-4 py-2.5">Uživatel</th>
                <th className="px-4 py-2.5">Modul</th>
                <th className="px-4 py-2.5">Akce</th>
                <th className="px-4 py-2.5">Objekt</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Načítám…
                  </td>
                </tr>
              ) : (data?.rows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Žádné záznamy.
                  </td>
                </tr>
              ) : (
                (data?.rows ?? []).map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("cs-CZ")}
                    </td>
                    <td className="px-4 py-2">{r.actor_email ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary">{MODULE_LABEL[r.module] ?? r.module}</Badge>
                    </td>
                    <td className="px-4 py-2">{r.action}</td>
                    <td className="px-4 py-2">
                      <div className="truncate">{r.entity_label ?? r.entity_id ?? "—"}</div>
                      {r.details && (
                        <div className="text-xs text-muted-foreground">
                          {Object.entries(r.details)
                            .slice(0, 3)
                            .map(([k, v]) => (
                              <span key={k} className="mr-3">
                                {k}: {String(v)}
                              </span>
                            ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
