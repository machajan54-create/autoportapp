import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listClaims, getPendingApprovalsCount } from "@/lib/claims.functions";
import { listDefects } from "@/lib/defects.functions";
import { listPurchases } from "@/lib/approvals.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  listAbsences as listDochAbsences,
  listEmployees as listDochEmployees,
  listRecords as listDochRecords,
} from "@/lib/dochazka.functions";

type NotifItem = {
  key: string;
  title: string;
  detail?: string;
  to: string;
  tone: "info" | "warn" | "danger";
};

// Per-category "last seen" timestamps in localStorage so personal notifications
// disappear after the user opens the bell.
const LS_KEY = "notif-last-seen-v1";
type LastSeen = Partial<Record<"purchases" | "defects" | "absences", string>>;
function readLastSeen(): LastSeen {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function writeLastSeen(v: LastSeen) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

export function NotificationsBell({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<LastSeen>(() => readLastSeen());
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
  const fetchClaims = useServerFn(listClaims);
  const fetchDefects = useServerFn(listDefects);
  const fetchAbs = useServerFn(listDochAbsences);
  const fetchEmp = useServerFn(listDochEmployees);
  const fetchRec = useServerFn(listDochRecords);
  const fetchPending = useServerFn(getPendingApprovalsCount);
  const fetchPurchases = useServerFn(listPurchases);

  const { data: claims } = useQuery({
    queryKey: ["notif", "claims"],
    queryFn: () => fetchClaims({}),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  const { data: defects } = useQuery({
    queryKey: ["notif", "defects"],
    queryFn: () => fetchDefects({}),
    refetchInterval: 60_000,
  });
  // Personal: my purchases + my absences (filtered server-side for non-admin)
  const { data: myPurchases } = useQuery({
    queryKey: ["notif", "my-purchases"],
    queryFn: () => fetchPurchases({}),
    enabled: !!userId,
    refetchInterval: 60_000,
  });
  const { data: myAbsences } = useQuery({
    queryKey: ["notif", "my-absences"],
    queryFn: () => fetchAbs({}),
    enabled: !!userId && !isAdmin,
    refetchInterval: 60_000,
  });
  const { data: absences } = useQuery({
    queryKey: ["notif", "absences"],
    queryFn: () => fetchAbs({}),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  const { data: emps } = useQuery({
    queryKey: ["notif", "emps"],
    queryFn: () => fetchEmp({}),
    enabled: isAdmin,
    refetchInterval: 5 * 60_000,
  });
  const yearStart = new Date().getFullYear() + "-01-01";
  const { data: recs } = useQuery({
    queryKey: ["notif", "recs", yearStart],
    queryFn: () => fetchRec({ data: { from: yearStart } }),
    enabled: isAdmin,
    refetchInterval: 5 * 60_000,
  });
  const { data: pending } = useQuery({
    queryKey: ["notif", "pending"],
    queryFn: () => fetchPending({}),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  const items = useMemo<NotifItem[]>(() => {
    const out: NotifItem[] = [];

    // ===== Personal notifications (all users): items I created whose status changed =====
    if (userId) {
      const sincePurchase = lastSeen.purchases ? Date.parse(lastSeen.purchases) : 0;
      const sinceDefects = lastSeen.defects ? Date.parse(lastSeen.defects) : 0;
      const sinceAbsences = lastSeen.absences ? Date.parse(lastSeen.absences) : 0;

      const mine = (myPurchases ?? []).filter(
        (p: any) => p.requested_by === userId && p.status !== "pending" && p.decided_at,
      );
      for (const p of mine) {
        if (Date.parse(String(p.decided_at)) <= sincePurchase) continue;
        const approved = p.status === "approved";
        out.push({
          key: `purchase-${p.id}-${p.status}`,
          title: `Nákup ${approved ? "schválen" : "zamítnut"}: ${p.title}`,
          detail: p.decision_note ?? undefined,
          to: "/approvals",
          tone: approved ? "info" : "warn",
        });
      }

      const myDefects = (defects?.rows ?? []).filter(
        (d: any) => d.reported_by === userId && d.status !== "new",
      );
      for (const d of myDefects) {
        const ts = d.resolved_at ?? d.updated_at;
        if (!ts || Date.parse(ts) <= sinceDefects) continue;
        const label =
          d.status === "in_progress" ? "v řešení" :
          d.status === "resolved" ? "vyřešena" :
          d.status === "closed" ? "uzavřena" : d.status;
        out.push({
          key: `defect-${d.id}-${d.status}`,
          title: `Vaše závada ${label}: ${d.title}`,
          to: "/zavady",
          tone: d.status === "resolved" || d.status === "closed" ? "info" : "warn",
        });
      }

      const personalAbs = (myAbsences ?? []).filter(
        (a: any) => a.status !== "pending" && a.resolved_at,
      );
      for (const a of personalAbs) {
        if (Date.parse(String(a.resolved_at)) <= sinceAbsences) continue;
        const approved = a.status === "approved";
        out.push({
          key: `absence-${a.id}-${a.status}`,
          title: `Absence ${approved ? "schválena" : "zamítnuta"} (${a.start_date} – ${a.end_date})`,
          to: "/dochazka",
          tone: approved ? "info" : "warn",
        });
      }
    }

    // ===== Admin-only operational notifications =====

    if (isAdmin && (pending?.count ?? 0) > 0) {
      out.push({
        key: "users-pending",
        title: `Uživatelé ke schválení: ${pending!.count}`,
        to: "/admin/users",
        tone: "warn",
      });
    }

    const pendAbs = (absences ?? []).filter((a: any) => a.status === "pending");
    if (pendAbs.length > 0) {
      out.push({
        key: "abs-pending",
        title: `Čekající absence: ${pendAbs.length}`,
        to: "/dochazka",
        tone: "warn",
      });
    }

    const newDefects = (defects?.rows ?? []).filter((d: any) => d.status === "new");
    if (newDefects.length > 0) {
      const crit = newDefects.filter((d: any) => d.priority === "critical").length;
      out.push({
        key: "defects-new",
        title: `Nové závady: ${newDefects.length}`,
        detail: crit > 0 ? `${crit} kritických` : undefined,
        to: "/zavady",
        tone: crit > 0 ? "danger" : "info",
      });
    }

    if (isAdmin) {
      const newClaims = (claims ?? []).filter((c: any) => c.status === "new").length;
      if (newClaims > 0) {
        out.push({
          key: "claims-new",
          title: `Nové pojistné události: ${newClaims}`,
          to: "/admin",
          tone: "info",
        });
      }
    }

    // DPP limit (300 h/rok)
    if (isAdmin && emps && recs) {
      const dpp = emps.filter((e: any) => e.employment_type === "dpp" && e.active);
      const hoursById = new Map<string, number>();
      for (const r of recs as any[]) {
        hoursById.set(r.employee_id, (hoursById.get(r.employee_id) ?? 0) + Number(r.hours_worked ?? 0));
      }
      for (const e of dpp) {
        const h = hoursById.get(e.id) ?? 0;
        if (h >= 300) {
          out.push({
            key: `dpp-over-${e.id}`,
            title: `DPP překročeno: ${e.name}`,
            detail: `${h.toFixed(1)} h / 300 h`,
            to: "/dochazka",
            tone: "danger",
          });
        } else if (h >= 270) {
          out.push({
            key: `dpp-warn-${e.id}`,
            title: `DPP blíží se limitu: ${e.name}`,
            detail: `${h.toFixed(1)} h / 300 h`,
            to: "/dochazka",
            tone: "warn",
          });
        }
      }
    }

    return out;
  }, [claims, defects, absences, emps, recs, pending, isAdmin, myPurchases, myAbsences, userId, lastSeen]);

  const count = items.length;

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          // Mark personal notifications as seen
          const now = new Date().toISOString();
          const next: LastSeen = { purchases: now, defects: now, absences: now };
          writeLastSeen(next);
          // Defer state update so the user briefly sees the items, then they clear next render
          setTimeout(() => setLastSeen(next), 400);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifikace" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifikace</span>
          <span className="text-xs text-muted-foreground">{count} {count === 1 ? "položka" : "položek"}</span>
        </div>
        {count === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">Vše v pořádku 🎉</div>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((it) => (
              <li key={it.key}>
                <Link
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      it.tone === "danger" && "bg-rose-500",
                      it.tone === "warn" && "bg-amber-500",
                      it.tone === "info" && "bg-sky-500",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{it.title}</span>
                    {it.detail && (
                      <span className="block text-xs text-muted-foreground">{it.detail}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}