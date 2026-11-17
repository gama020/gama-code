import { hostedAppSurface } from "@t3tools/contracts";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { HostedAppRoutePlaceholder } from "../components/hostedApp/HostedAppSurface";

export const Route = createFileRoute("/apps/$surfaceId")({
  // A hosted app still needs a signed-in Gama Os shell; the root route renders bare otherwise.
  beforeLoad: ({ context, params }) => {
    if (!hostedAppSurface(params.surfaceId)) throw notFound();
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: HostedAppRoute,
});

function HostedAppRoute() {
  const { surfaceId } = Route.useParams();
  return <HostedAppRoutePlaceholder surfaceId={surfaceId} />;
}
