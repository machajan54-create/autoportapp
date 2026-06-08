import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ShieldCheck, FolderKanban, LogOut, Users, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const navItem = (to: string, label: string, Icon: typeof FolderKanban) => {
    const active = pathname === to || (to !== "/admin" && pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-foreground/70 hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-4 font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Pojistné události
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItem("/admin", "Zakázky", FolderKanban)}
          {navItem("/vykupy", "Ojeté vozy", Car)}
          {navItem("/admin/users", "Uživatelé", Users)}
        </nav>
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
          <Link to="/admin" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Pojistné události
          </Link>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}