/**
 * Trusted surfaces the desktop shell hosts as an app instead of as a browser tab.
 *
 * These partitions deliberately do not inherit the preview profile's relaxed web preferences: a
 * signed-in web app can require an exact `Origin` on writes, and a null origin turns its API into
 * a 403. They also skip the preview manager, so no CDP relay, history, or annotation is attached.
 */
export const APP_SURFACE_PARTITION_PREFIX = "persist:t3code-app-";
export const APP_SURFACE_ROUTE_PREFIX = "/apps/";

export interface HostedAppSurface {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  /** Origins the guest may navigate to in place. Anything else opens in the system browser. */
  readonly origins: readonly string[];
}

export const OPENBOT_SURFACE = {
  id: "openbot",
  title: "OpenBot",
  url: "https://openbot.run/app",
  origins: ["https://openbot.run"],
} satisfies HostedAppSurface;

export const CREATIVE_OS_SURFACE = {
  id: "creative-os",
  title: "Creative OS",
  url: "https://app.gamacreativedesign.com.br/",
  origins: ["https://app.gamacreativedesign.com.br"],
} satisfies HostedAppSurface;

export const HOSTED_APP_SURFACES: readonly HostedAppSurface[] = [
  OPENBOT_SURFACE,
  CREATIVE_OS_SURFACE,
];

export function hostedAppSurface(surfaceId: string): HostedAppSurface | undefined {
  return HOSTED_APP_SURFACES.find((surface) => surface.id === surfaceId);
}

export function hostedAppSurfacePartition(surfaceId: string): string {
  return `${APP_SURFACE_PARTITION_PREFIX}${surfaceId}`;
}

export function isAppSurfacePartition(partition: string): boolean {
  return partition.startsWith(APP_SURFACE_PARTITION_PREFIX);
}

/** Electron hides a guest's partition, so a guest is matched back to its surface by its session. */
export function hostedAppSurfaceForPartition(partition: string): HostedAppSurface | undefined {
  if (!isAppSurfacePartition(partition)) return undefined;
  return hostedAppSurface(partition.slice(APP_SURFACE_PARTITION_PREFIX.length));
}

/** Navigation inside a hosted app stays on its own origins; everything else opens in the browser. */
export function isHostedAppSurfaceUrl(surface: HostedAppSurface, rawUrl: string): boolean {
  try {
    return surface.origins.includes(new URL(rawUrl).origin);
  } catch {
    return false;
  }
}

export function hostedAppSurfacePath(surfaceId: string): string {
  return `${APP_SURFACE_ROUTE_PREFIX}${surfaceId}`;
}

export function hostedAppSurfaceIdFromPathname(pathname: string): string | undefined {
  if (!pathname.startsWith(APP_SURFACE_ROUTE_PREFIX)) return undefined;
  const surfaceId = pathname.slice(APP_SURFACE_ROUTE_PREFIX.length).split("/")[0] ?? "";
  return hostedAppSurface(surfaceId)?.id;
}
