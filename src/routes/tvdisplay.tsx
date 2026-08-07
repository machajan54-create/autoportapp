import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tvdisplay")({
  beforeLoad: () => {
    throw redirect({ to: "/TVdisplay" });
  },
});
