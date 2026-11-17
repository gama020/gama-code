import { RouterProvider } from "@tanstack/react-router";

import { ElectronBrowserHost } from "./browser/ElectronBrowserHost";
import { QuitHoldOverlay } from "./components/QuitHoldOverlay";
import { I18nProvider as GamaI18nProvider } from "./i18n";
import { I18nProvider } from "./i18n/I18nProvider";
import { AppAtomRegistryProvider } from "./rpc/atomRegistry";
import type { AppRouter } from "./router";

// Keep webviews outside the router but inside its atom registry so route changes preserve them.
export function AppRoot({ router }: { readonly router: AppRouter }) {
  return (
    <I18nProvider>
      {/* gt-react covers upstream's translated copy; the Gama Os provider backs useTranslation's locale switch. */}
      <GamaI18nProvider>
        <AppAtomRegistryProvider>
          <RouterProvider router={router} />
          <ElectronBrowserHost />
          <QuitHoldOverlay />
        </AppAtomRegistryProvider>
      </GamaI18nProvider>
    </I18nProvider>
  );
}
