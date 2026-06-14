import { createFileRoute } from "@tanstack/react-router";
import autoportLogo from "@/assets/autoport-logo.png.asset.json";

/**
 * Web App Manifest — slouží pro instalaci na plochu telefonu / "přidat na plochu".
 * Nedělá se offline cache (žádný service worker), pouze instalace + ikony.
 */
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async () => {
        const manifest = {
          name: "Autoport APP",
          short_name: "Autoport",
          description: "Interní systém Autoport — pojistné události, výkupy, docházka, závady.",
          start_url: "/dashboard",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          theme_color: "#0f172a",
          background_color: "#ffffff",
          lang: "cs",
          icons: [
            { src: autoportLogo.url, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: autoportLogo.url, sizes: "512x512", type: "image/png", purpose: "any" },
            { src: autoportLogo.url, sizes: "any", type: "image/png", purpose: "maskable" },
          ],
        };
        return new Response(JSON.stringify(manifest, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});