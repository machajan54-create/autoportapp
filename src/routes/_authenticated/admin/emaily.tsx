import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listEmailDeliveries, listPlatformEmailEvents } from "@/lib/email-log.functions";

export const Route = createFileRoute("/_authenticated/admin/emaily")({
  component: EmailLogPage,
  head: () => ({
    meta: [
      { title: "Doručování e-mailů | Autoport APP" },
      {
        name: "description",
        content: "Přehled stavu odeslaných e-mailů – odesláno, selhalo, potlačeno nebo vráceno.",
      },
      { property: "og:title", content: "Doručování e-mailů | Autoport APP" },
      {
        property: "og:description",
        content: "Přehled stavu odeslaných e-mailů aplikace Autoport.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Ve frontě",
  sent: "Odesláno",
  failed: "Selhalo",
  suppressed: "Potlačeno",
  bounced: "Nedoručeno",
  complained: "Stížnost",
  dlq: "Nedoručeno (fronta)",
  rejected: "Odmítnuto",
  unsubscribed: "Odhlášeno",
  rate_limited: "Omezeno limitem",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "default",
  pending: "secondary",
  suppressed: "secondary",
  unsubscribed: "secondary",
  failed: "destructive",
  bounced: "destructive",
  complained: "destructive",
  dlq: "destructive",
  rejected: "destructive",
  rate_limited: "outline",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{STATUS_LABEL[status] ?? status}</Badge>
  );
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString("cs-CZ");
}

function EmailLogPage() {
  const [status, setStatus] = useState("");
  const [template, setTemplate] = useState("");
  const [search, setSearch] = useState("");
  const fetchLog = useServerFn(listEmailDeliveries);
  const fetchPlatform = useServerFn(listPlatformEmailEvents);

  const { data, isLoading, error } = useQuery({
    queryKey: ["email-log", status, template, search],
    queryFn: () =>
      fetchLog({
        data: {
          status: status || null,
          template: template || null,
          search: search || null,
          limit: 300,
        },
      }),
    refetchInterval: 60_000,
  });

  const { data: platform, isLoading: platformLoading } = useQuery({
    queryKey: ["email-platform-log"],
    queryFn: () => fetchPlatform({ data: { limit: 100 } }),
    refetchInterval: 120_000,
  });

  const counts = data?.counts ?? {};
  const cards = [
    { key: "sent", label: "Odesláno" },
    { key: "failed", label: "Selhalo" },
    { key: "suppressed", label: "Potlačeno" },
    { key: "bounced", label: "Nedoručeno" },
  ];

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold">Doručování e-mailů</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stav jednotlivých e-mailů, které aplikace odeslala – za posledních 30 dní.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.key}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="mt-1 text-2xl font-semibold">{counts[c.key] ?? 0}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="app" className="mt-6">
          <TabsList>
            <TabsTrigger value="app">Odeslané e-maily</TabsTrigger>
            <TabsTrigger value="platform">Události doručování</TabsTrigger>
          </TabsList>

          <TabsContent value="app" className="mt-4">
            <div className="flex flex-wrap gap-3">
              <div className="w-48">
                <Select
                  value={status || "__all"}
                  onValueChange={(v) => setStatus(v === "__all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Stav" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Všechny stavy</SelectItem>
                    {Object.keys(STATUS_LABEL).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-56">
                <Select
                  value={template || "__all"}
                  onValueChange={(v) => setTemplate(v === "__all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Šablona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Všechny šablony</SelectItem>
                    {(data?.templates ?? []).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="w-64"
                placeholder="Hledat příjemce…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {error ? (
              <p className="mt-6 text-sm text-destructive">Nepodařilo se načíst záznamy.</p>
            ) : isLoading ? (
              <p className="mt-6 text-sm text-muted-foreground">Načítám…</p>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">Žádné záznamy.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Čas</th>
                      <th className="px-3 py-2 font-medium">Příjemce</th>
                      <th className="px-3 py-2 font-medium">Šablona</th>
                      <th className="px-3 py-2 font-medium">Stav</th>
                      <th className="px-3 py-2 font-medium">Poznámka</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {fmt(r.created_at)}
                        </td>
                        <td className="px-3 py-2">{r.recipient_email}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.template_name}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.error_message ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="platform" className="mt-4">
            {platformLoading ? (
              <p className="text-sm text-muted-foreground">Načítám…</p>
            ) : platform?.error ? (
              <p className="text-sm text-destructive">{platform.error}</p>
            ) : (platform?.events.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Žádné události.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Čas</th>
                      <th className="px-3 py-2 font-medium">Příjemce</th>
                      <th className="px-3 py-2 font-medium">Událost</th>
                      <th className="px-3 py-2 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platform!.events.map((e, i) => (
                      <tr key={`${e.timestamp}-${i}`} className="border-t">
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {fmt(e.timestamp)}
                        </td>
                        <td className="px-3 py-2">{e.recipient}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={e.event_type} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{e.status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Události se zaznamenávají pouze u publikované aplikace. Informace o otevření e-mailu
              nejsou k dispozici.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}
