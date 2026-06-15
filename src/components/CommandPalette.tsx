import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, FolderKanban, Car, Clock, Wrench, CheckSquare, Users, FileText, BookOpen,
} from "lucide-react";
import { listClaims } from "@/lib/claims.functions";
import { listVykupy } from "@/lib/vykupy";
import { listDefects } from "@/lib/defects.functions";
import { listEmployees as listDochEmployees } from "@/lib/dochazka.functions";

type ModuleKey = "claims" | "vykupy" | "vykupy_external" | "users" | "approvals" | "dashboard" | "dochazka" | "defects" | "deals" | "logbook" | "tasks" | "demo_orders" | "evidence_zakazek";

export function CommandPalette({
  isAdmin,
  modules,
}: {
  isAdmin: boolean;
  modules: ReadonlyArray<ModuleKey>;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const can = (m: ModuleKey) => modules.includes(m);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fetchClaims = useServerFn(listClaims);
  const fetchDefects = useServerFn(listDefects);
  const fetchEmps = useServerFn(listDochEmployees);

  const { data: claims } = useQuery({
    queryKey: ["cmdk", "claims"],
    queryFn: () => fetchClaims({}),
    enabled: open && (isAdmin || can("claims")),
    staleTime: 60_000,
  });
  const { data: vykupy } = useQuery({
    queryKey: ["cmdk", "vykupy"],
    queryFn: () => listVykupy(),
    enabled: open && (isAdmin || can("vykupy") || can("vykupy_external")),
    staleTime: 60_000,
  });
  const { data: defects } = useQuery({
    queryKey: ["cmdk", "defects"],
    queryFn: () => fetchDefects({}),
    enabled: open,
    staleTime: 60_000,
  });
  const { data: emps } = useQuery({
    queryKey: ["cmdk", "emps"],
    queryFn: () => fetchEmps({}),
    enabled: open && (isAdmin || can("dochazka")),
    staleTime: 60_000,
  });

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  const navItems = useMemo(() => {
    const list: { label: string; to: string; icon: any }[] = [];
    if (isAdmin || can("dashboard")) list.push({ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard });
    if (can("claims")) list.push({ label: "Zakázky", to: "/admin", icon: FolderKanban });
    if (can("vykupy") || can("vykupy_external")) list.push({ label: "Ojeté vozy", to: "/vykupy", icon: Car });
    if (can("dochazka")) list.push({ label: "Docházka", to: "/dochazka", icon: Clock });
    list.push({ label: "Závady", to: "/zavady", icon: Wrench });
    if (isAdmin || can("approvals")) list.push({ label: "Schvalování", to: "/approvals", icon: CheckSquare });
    if (can("logbook")) list.push({ label: "Kniha jízd", to: "/logbook", icon: BookOpen });
    if (isAdmin) list.push({ label: "Uživatelé", to: "/admin/users", icon: Users });
    if (isAdmin) list.push({ label: "Šablony dokumentů", to: "/admin/templates", icon: FileText });
    return list;
  }, [isAdmin, modules]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Hledat zakázky, vozy, závady, zaměstnance… (⌘K)" />
      <CommandList>
        <CommandEmpty>Nic nenalezeno.</CommandEmpty>

        <CommandGroup heading="Navigace">
          {navItems.map((n) => (
            <CommandItem key={n.to} onSelect={() => go(n.to)}>
              <n.icon className="mr-2 h-4 w-4" /> {n.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {claims && claims.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Zakázky">
              {claims.slice(0, 20).map((c: any) => (
                <CommandItem
                  key={c.id}
                  value={`${c.pu_number ?? ""} ${c.client_name ?? ""} ${c.spz ?? ""} ${c.vin ?? ""}`}
                  onSelect={() => go(`/admin/${c.id}`)}
                >
                  <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    <span className="font-mono text-xs">{c.pu_number ?? "—"}</span>{" · "}
                    {c.client_name ?? "—"}
                    {c.spz && <span className="text-muted-foreground"> · {c.spz}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {vykupy && vykupy.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ojeté vozy">
              {vykupy.slice(0, 20).map((v: any) => (
                <CommandItem
                  key={v.id}
                  value={`${v.znacka ?? ""} ${v.model ?? ""} ${v.spz ?? ""} ${v.vin ?? ""} ${v.prodejce ?? ""}`}
                  onSelect={() => go(`/vykupy/${v.id}`)}
                >
                  <Car className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    {v.znacka} {v.model}
                    {v.spz && <span className="text-muted-foreground"> · {v.spz}</span>}
                    {v.stav && <span className="text-muted-foreground"> · {v.stav}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {defects?.rows && defects.rows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Závady">
              {defects.rows.slice(0, 15).map((d: any) => (
                <CommandItem
                  key={d.id}
                  value={`${d.title ?? ""} ${d.description ?? ""}`}
                  onSelect={() => go("/zavady")}
                >
                  <Wrench className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{d.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {emps && emps.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Zaměstnanci">
              {emps.slice(0, 20).map((e: any) => (
                <CommandItem
                  key={e.id}
                  value={`${e.name ?? ""} ${e.pin ?? ""}`}
                  onSelect={() => go("/dochazka")}
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    {e.name}
                    {e.employment_type && (
                      <span className="text-muted-foreground"> · {String(e.employment_type).toUpperCase()}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}