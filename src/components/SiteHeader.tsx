import { Link } from "@tanstack/react-router";
import autoportLogo from "@/assets/autoport-logo.png.asset.json";

export function SiteHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link
          to="/"
          className="flex items-center font-semibold text-foreground"
          aria-label="Autoport APP"
        >
          <img src={autoportLogo.url} alt="Autoport APP" className="h-8 w-auto object-contain" />
        </Link>
        <div className="text-sm text-muted-foreground">{rightSlot}</div>
      </div>
    </header>
  );
}
