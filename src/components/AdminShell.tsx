import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ShieldCheck, FolderKanban, LogOut, Users, Car, Menu, LayoutDashboard, FileText, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccess, getPendingApprovalsCount } from "@/lib/claims.functions";

type ModuleKey = "claims" | "vykupy" | "users" | "approvals" | "dashboard";

export function AdminShell({
  children,
  requireModule,
}: {
  children: React.ReactNode;
  requireModule?: ModuleKey;
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
      {can("vykupy") && navItem("/vykupy", "Ojeté vozy", Car)}
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
    ) : requireModule && access && !can(requireModule) ? (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h2 className="text-lg font-semibold">Nemáte přístup k tomuto modulu</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Požádejte super admina o přidělení přístupu.
        </p>
      </div>
    ) : null;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-4 font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Pojistné události
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
                <div className="flex h-16 items-center gap-2 border-b px-4 font-semibold">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Pojistné události
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
            <Link to="/admin" className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-sm">Pojistné události</span>
            </Link>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Odhlásit">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-x-hidden">{denied ?? children}</main>
      </div>
    </div>
  );
}