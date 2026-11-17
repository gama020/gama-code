import { describe, expect, it } from "@effect/vitest";

import {
  APP_SURFACE_PARTITION_PREFIX,
  APP_SURFACE_ROUTE_PREFIX,
  CREATIVE_OS_SURFACE,
  HOSTED_APP_SURFACES,
  hostedAppSurface,
  hostedAppSurfaceForPartition,
  hostedAppSurfaceIdFromPathname,
  hostedAppSurfacePartition,
  hostedAppSurfacePath,
  isAppSurfacePartition,
  isHostedAppSurfaceUrl,
  OPENBOT_SURFACE,
} from "./appSurface.ts";

describe("hosted app surfaces", () => {
  it("exposes the surfaces the shell can host", () => {
    expect(HOSTED_APP_SURFACES.map((surface) => surface.id)).toEqual(["openbot", "creative-os"]);
    expect(hostedAppSurface("creative-os")).toBe(CREATIVE_OS_SURFACE);
    expect(hostedAppSurface("nope")).toBeUndefined();
  });

  it("keeps app partitions apart from preview profiles", () => {
    expect(hostedAppSurfacePartition("openbot")).toBe(`${APP_SURFACE_PARTITION_PREFIX}openbot`);
    expect(isAppSurfacePartition(hostedAppSurfacePartition("creative-os"))).toBe(true);
    expect(isAppSurfacePartition("persist:t3code-preview-profile-abc")).toBe(false);
    expect(isAppSurfacePartition("persist:personal")).toBe(false);
  });

  it("resolves a guest partition back to its surface", () => {
    expect(hostedAppSurfaceForPartition(hostedAppSurfacePartition("openbot"))).toBe(
      OPENBOT_SURFACE,
    );
    expect(hostedAppSurfaceForPartition(hostedAppSurfacePartition("creative-os"))).toBe(
      CREATIVE_OS_SURFACE,
    );
    expect(hostedAppSurfaceForPartition(hostedAppSurfacePartition("unknown"))).toBeUndefined();
    expect(hostedAppSurfaceForPartition("persist:t3code-preview-profile-abc")).toBeUndefined();
  });

  it("allows navigation only on the surface's own origins", () => {
    expect(isHostedAppSurfaceUrl(OPENBOT_SURFACE, OPENBOT_SURFACE.url)).toBe(true);
    expect(isHostedAppSurfaceUrl(OPENBOT_SURFACE, "https://openbot.run/app/settings")).toBe(true);
    expect(isHostedAppSurfaceUrl(OPENBOT_SURFACE, "https://openbot.run.evil.test/app")).toBe(false);
    expect(isHostedAppSurfaceUrl(OPENBOT_SURFACE, CREATIVE_OS_SURFACE.url)).toBe(false);
    expect(isHostedAppSurfaceUrl(CREATIVE_OS_SURFACE, CREATIVE_OS_SURFACE.url)).toBe(true);
    expect(
      isHostedAppSurfaceUrl(CREATIVE_OS_SURFACE, "https://app.gamacreativedesign.com.br/projetos"),
    ).toBe(true);
    expect(isHostedAppSurfaceUrl(CREATIVE_OS_SURFACE, "https://example.com/")).toBe(false);
    expect(isHostedAppSurfaceUrl(CREATIVE_OS_SURFACE, "not a url")).toBe(false);
  });

  it("maps surfaces to their route", () => {
    expect(hostedAppSurfacePath("creative-os")).toBe(`${APP_SURFACE_ROUTE_PREFIX}creative-os`);
    expect(hostedAppSurfaceIdFromPathname("/apps/openbot")).toBe("openbot");
    expect(hostedAppSurfaceIdFromPathname("/apps/creative-os/")).toBe("creative-os");
    expect(hostedAppSurfaceIdFromPathname("/apps/creative-os/projetos/42")).toBe("creative-os");
    expect(hostedAppSurfaceIdFromPathname("/apps/unknown")).toBeUndefined();
    expect(hostedAppSurfaceIdFromPathname("/openbot")).toBeUndefined();
  });
});
