import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Použijeme getSession() — čte z localStorage, takže nás přechodné výpadky
    // sítě nebo zpomalený /user endpoint Auth služby nepřihlásí omylem ven.
    // Bearer token se k chráněným server fn připojí přes attachSupabaseAuth
    // a server ho validuje sám.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/auth" });
    return { user: session.user };
  },
  component: () => <Outlet />,
});