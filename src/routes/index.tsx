import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pojistné události — online nahlášení" },
      {
        name: "description",
        content:
          "Nahlaste pojistnou událost online. Připravíme plné moci a postaráme se o komunikaci s pojišťovnou.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        rightSlot={
          <Link to="/auth" className="hover:text-foreground">
            Přihlášení
          </Link>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-20">
        <h1 className="max-w-2xl text-5xl font-bold tracking-tight text-foreground">
          Nahlaste pojistnou událost online
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Vyplňte krátký formulář, přiložte fotografie a podepište se. Připravíme plné moci a
          postaráme se o komunikaci s pojišťovnou.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/nahlasit">
              Nahlásit událost <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Přihlášení pro zaměstnance</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
