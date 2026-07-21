import { createFileRoute } from "@tanstack/react-router";
import { TvDisplay } from "@/components/tv/TvDisplay";

export const Route = createFileRoute("/tv/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autoport TV Display" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=1920, initial-scale=1" },
    ],
  }),
  component: TvDisplayRoute,
});

function TvDisplayRoute() {
  const { token } = Route.useParams();
  return <TvDisplay token={token} />;
}
