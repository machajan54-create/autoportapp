import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ShieldCheck, FolderKanban, LogOut, Users, Car, Menu, LayoutDashboard, FileText, CheckSquare, Clock, Wrench, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccess, getPendingApprovalsCount } from "@/lib/claims.functions";
import autoportLogo from "@/assets/autoport-logo.png.asset.json";
import { NotificationsBell } from "@/components/NotificationsBell";
import { CommandPalette } from "@/components/CommandPalette";

type ModuleKey = "claims" | "vykupy" | "vykupy_external" | "users" | "approvals" | "dashboard" | "dochazka" | "defects";

export function AdminShell({
  children,
  requireModule,
}: {
  children: React.ReactNode;
  requireModule?: ModuleKey | ModuleKey[];
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const fetchAccess = useServerFn(getMyAccess);
  const fetchPending = useServerFn(getPendingApprovalsCount);
  const { data: access } = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess({}),
  });
  const { data: pending } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: () => fetchPending({}),
    enabled: !!access?.isAdmin,
    refetchInterval: 60_000,
  });
  const pendingCount = pending?.count ?? 0;
  const modules = (access?.modules ?? []) as ReadonlyArray<ModuleKey>;
  const can = (m: ModuleKey) => modules.includes(m);
  const canAny = (m: ModuleKey | ModuleKey[]) =>
    Array.isArray(m) ? m.some((x) => can(x)) : can(m);
  const isAdmin = !!access?.isAdmin;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const navItem = (
    to: string,
    label: string,
    Icon: typeof FolderKanban,
    badge?: number,
  ) => {
    const active = pathname === to || (to !== "/admin" && pathname.startsWith(to));
    return (
      <Link
        to={to}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-foreground/70 hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{label}</span>
        {badge && badge > 0 ? (
          <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
            {badge}
          </span>
        ) : null}
      </Link>
    );
  };

  const navList = (
    <nav className="flex-1 space-y-1 p-3">
      {(access?.isAdmin || can("dashboard")) && navItem("/dashboard", "Dashboard", LayoutDashboard)}
      {can("claims") && navItem("/admin", "Zakázky", FolderKanban)}
      {(can("vykupy") || can("vykupy_external")) && navItem("/vykupy", "Ojeté vozy", Car)}
      {can("dochazka") && navItem("/dochazka", "Docházka", Clock)}
      {navItem("/zavady", "Závady", Wrench)}
      {(access?.isAdmin || can("approvals")) && navItem("/approvals", "Schvalování", CheckSquare)}
      {access?.isAdmin && navItem("/admin/users", "Uživatelé", Users, pendingCount)}
      {access?.isAdmin && navItem("/admin/templates", "Šablony dokumentů", FileText)}
    </nav>
  );

  const denied =
    access && access.approved === false ? (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h2 className="text-lg font-semibold">Účet čeká na schválení</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Super admin musí váš účet nejprve schválit.
        </p>
        <Button variant="outline" size="sm" className="mt-6" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" /> Odhlásit
        </Button>
      </div>
    ) : requireModule && access && !canAny(requireModule) ? (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h2 className="text-lg font-semibold">Nemáte přístup k tomuto modulu</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Požádejte super admina o přidělení přístupu.
        </p>
      </div>
    ) : null;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <CommandPalette isAdmin={isAdmin} modules={modules} />
      <aside className="hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center border-b px-4">
          <img src={autoportLogo.url} alt="Autoport APP" className="h-8 w-auto object-contain" />
        </div>
        {navList}
        <div className="border-t p-3">
          <div className="truncate px-2 pb-2 text-xs text-muted-foreground">{email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Odhlásit
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex w-full flex-col">
        {/* Desktop top bar with search + notifications */}
        <header className="hidden h-12 items-center justify-end gap-2 border-b bg-card px-4 md:flex">
          <button
            type="button"
            onClick={() => {
              const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
              window.dispatchEvent(ev);
            }}
            className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Hledat…</span>
            <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
          </button>
          <NotificationsBell isAdmin={isAdmin} />
        </header>
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigace</SheetTitle>
                <div className="flex h-16 items-center border-b px-4">
                  <img src={autoportLogo.url} alt="Autoport APP" className="h-8 w-auto object-contain" />
                </div>
                {navList}
                <div className="border-t p-3">
                  <div className="truncate px-2 pb-2 text-xs text-muted-foreground">{email}</div>
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Odhlásit
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <Link to="/admin" className="flex items-center" aria-label="Autoport APP">
              <img src={autoportLogo.url} alt="Autoport APP" className="h-7 w-auto object-contain" />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell isAdmin={isAdmin} />
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Odhlásit">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden">{denied ?? children}</main>
      </div>
    </div>
  );
}