import { createFileRoute, redirect } from "@tanstack/react-router";

// Older builds linked the OpenBot surface at /openbot; keep the link working.
export const Route = createFileRoute("/openbot")({
  beforeLoad: () => {
    throw redirect({
      to: "/apps/$surfaceId",
      params: { surfaceId: "openbot" },
      replace: true,
    });
  },
});
