import { AppWindowIcon, BotIcon, FingerprintIcon } from "lucide-react";

import type { LucideIcon } from "lucide-react";

/** Icons live in the web app because the contract layer stays framework-free. */
export function hostedAppSurfaceIcon(surfaceId: string): LucideIcon {
  switch (surfaceId) {
    case "openbot":
      return BotIcon;
    case "creative-os":
      return FingerprintIcon;
    default:
      return AppWindowIcon;
  }
}
