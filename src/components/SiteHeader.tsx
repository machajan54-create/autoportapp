import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export function SiteHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Autoport APP
        </Link>
        <div className="text-sm text-muted-foreground">{rightSlot}</div>
      </div>
    </header>
  );
}