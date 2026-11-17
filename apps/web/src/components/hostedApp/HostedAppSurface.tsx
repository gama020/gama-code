import {
  type HostedAppSurface,
  hostedAppSurface,
  hostedAppSurfaceIdFromPathname,
  hostedAppSurfacePartition,
} from "@t3tools/contracts";
import { useLocation } from "@tanstack/react-router";
import { ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSidebar, useSidebarVisibility } from "~/components/ui/sidebar";
import { isElectron } from "~/env";
import { cn } from "~/lib/utils";

type SurfaceFailure = { readonly description: string } | null;

interface AppWebviewElement extends HTMLElement {
  reload: () => void;
}

interface DidFailLoadDetail extends Event {
  readonly errorCode: number;
  readonly errorDescription: string;
  readonly isMainFrame: boolean;
}

// A webview reports an aborted load when navigation replaces a pending one; that is not a failure.
const ABORTED_LOAD_ERROR_CODE = -3;

function openInSystemBrowser(url: string) {
  if (window.desktopBridge) {
    void window.desktopBridge.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function surfaceHost(surface: HostedAppSurface): string {
  return new URL(surface.url).host;
}

function DesktopOnlyNotice({ surface }: { surface: HostedAppSurface }) {
  return (
    <div className="grid h-full place-items-center bg-gama-canvas px-6">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-sm font-medium text-foreground">{surface.title} roda no app desktop</h1>
        <p className="text-xs leading-relaxed text-gama-muted">
          A versão web do Gama Os não pode hospedar {surface.title}: o serviço recusa ser exibido em
          frame. Abra o endereço direto no navegador ou use o app desktop.
        </p>
        <button
          type="button"
          onClick={() => openInSystemBrowser(surface.url)}
          className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-foreground hover:bg-white/5"
        >
          Abrir {surfaceHost(surface)}
        </button>
      </div>
    </div>
  );
}

/** The route only fills the pane; the live surface lives in the app shell. */
export function HostedAppRoutePlaceholder({ surfaceId }: { surfaceId: string }) {
  const surface = hostedAppSurface(surfaceId);
  if (isElectron || !surface) return null;
  return <DesktopOnlyNotice surface={surface} />;
}

function HostedAppGuest({ surface }: { surface: HostedAppSurface }) {
  const webviewRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<SurfaceFailure>(null);

  const reload = () => {
    setLoading(true);
    setFailure(null);
    (webviewRef.current as AppWebviewElement | null)?.reload();
  };

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- mirrors the guest's load lifecycle into the app header
  useEffect(() => {
    const webview = webviewRef.current as AppWebviewElement | null;
    if (!webview) return;
    const start = () => setLoading(true);
    const settle = () => {
      setLoading(false);
      setFailure(null);
    };
    const fail = (event: Event) => {
      const detail = event as DidFailLoadDetail;
      if (!detail.isMainFrame || detail.errorCode === ABORTED_LOAD_ERROR_CODE) return;
      setLoading(false);
      setFailure({ description: detail.errorDescription || `Falha ao carregar ${surface.title}.` });
    };
    const gone = () => {
      setLoading(false);
      setFailure({ description: `O processo do ${surface.title} encerrou.` });
    };
    webview.addEventListener("did-start-loading", start);
    webview.addEventListener("dom-ready", settle);
    webview.addEventListener("did-stop-loading", settle);
    webview.addEventListener("did-fail-load", fail);
    webview.addEventListener("render-process-gone", gone);
    return () => {
      webview.removeEventListener("did-start-loading", start);
      webview.removeEventListener("dom-ready", settle);
      webview.removeEventListener("did-stop-loading", settle);
      webview.removeEventListener("did-fail-load", fail);
      webview.removeEventListener("render-process-gone", gone);
    };
  }, [surface.title]);

  return (
    <>
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-white/8 px-3 text-xs select-none">
        <span
          className={cn(
            "size-1.5 rounded-full",
            failure ? "bg-gama-pink/80" : loading ? "bg-gama-accent/80" : "bg-gama-green/80",
          )}
          aria-hidden="true"
        />
        <span className="font-medium text-foreground/90">{surface.title}</span>
        <span className="truncate text-gama-muted">{surfaceHost(surface)}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label={`Recarregar ${surface.title}`}
            onClick={reload}
            className="grid size-6 place-items-center rounded-md text-gama-muted hover:bg-white/5 hover:text-foreground"
          >
            <RefreshCwIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Abrir ${surface.title} no navegador`}
            onClick={() => openInSystemBrowser(surface.url)}
            className="grid size-6 place-items-center rounded-md text-gama-muted hover:bg-white/5 hover:text-foreground"
          >
            <ExternalLinkIcon className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 bg-gama-canvas">
        <webview
          ref={webviewRef}
          // Electron needs allowpopups at attachment. React drops boolean values for unknown
          // attributes, and the host denies every popup after handing the URL to the browser.
          {...({ allowpopups: "true" } as unknown as { readonly allowpopups?: boolean })}
          src={surface.url}
          partition={hostedAppSurfacePartition(surface.id)}
          // Keeping the guest unthrottled preserves timers and sockets while another thread is open.
          webpreferences="contextIsolation=true,sandbox=true,nodeIntegration=false,webSecurity=true,backgroundThrottling=false"
          className={cn("size-full", failure && "invisible")}
        />

        {loading && !failure ? (
          <div
            className="pointer-events-none absolute inset-0 grid place-items-center bg-gama-canvas"
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="size-5 animate-spin rounded-full border border-white/15 border-t-white/70" />
              <span className="text-xs text-gama-muted">Conectando ao {surface.title}…</span>
            </div>
          </div>
        ) : null}

        {failure ? (
          <div className="absolute inset-0 grid place-items-center bg-gama-canvas px-6">
            <div className="max-w-sm space-y-3 text-center">
              <h1 className="text-sm font-medium text-foreground">
                Não foi possível abrir o {surface.title}
              </h1>
              <p className="text-xs leading-relaxed text-gama-muted">{failure.description}</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={reload}
                  className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-foreground hover:bg-white/5"
                >
                  Tentar novamente
                </button>
                <button
                  type="button"
                  onClick={() => openInSystemBrowser(surface.url)}
                  className="rounded-md px-2.5 py-1.5 text-xs text-gama-muted hover:bg-white/5 hover:text-foreground"
                >
                  Abrir no navegador
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function HostedAppPane({ surface, active }: { surface: HostedAppSurface; active: boolean }) {
  return (
    <div
      aria-hidden={active ? undefined : true}
      data-hosted-app={surface.id}
      data-hosted-app-state={active ? "active" : "inactive"}
      className={cn(
        "absolute inset-0 z-10 flex min-h-0 flex-col bg-gama-canvas",
        !active && "pointer-events-none opacity-0",
      )}
    >
      <HostedAppGuest surface={surface} />
    </div>
  );
}

/** Every transition into a hosted app takes the full width; leaving gives the sidebar back. */
function useHostedAppSidebar(activeSurfaceId: string | undefined) {
  const { isMobile, setOpen, setOpenMobile } = useSidebar();
  const sidebarVisible = useSidebarVisibility();
  const lastSurfaceId = useRef<string | undefined>(undefined);
  const restoreSidebar = useRef(false);

  // A hosted app is a full app, not a thread: give it the width and keep only the activity rail.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- route transition drives the shell's sidebar state
  useEffect(() => {
    if (!isElectron || lastSurfaceId.current === activeSurfaceId) return;
    const wasHosted = lastSurfaceId.current !== undefined;
    lastSurfaceId.current = activeSurfaceId;
    const setSidebarOpen = isMobile ? setOpenMobile : setOpen;
    if (activeSurfaceId !== undefined) {
      // Remember what the user had before the first hosted app, so leaving restores their choice.
      if (!wasHosted) restoreSidebar.current = sidebarVisible;
      setSidebarOpen(false);
      return;
    }
    if (!wasHosted || !restoreSidebar.current) return;
    restoreSidebar.current = false;
    setSidebarOpen(true);
  }, [activeSurfaceId, isMobile, setOpen, setOpenMobile, sidebarVisible]);
}

/**
 * Mounted once by the app shell. Opening another thread hides a surface instead of unmounting it,
 * so a guest keeps its connection, session and open conversation alive.
 */
export function HostedAppStack() {
  const activeSurfaceId = useLocation({
    select: (location) => hostedAppSurfaceIdFromPathname(location.pathname),
  });
  const [mountedSurfaceIds, setMountedSurfaceIds] = useState<readonly string[]>(
    activeSurfaceId ? [activeSurfaceId] : [],
  );
  // First visit mounts the guest; later visits only toggle visibility.
  if (activeSurfaceId && !mountedSurfaceIds.includes(activeSurfaceId)) {
    setMountedSurfaceIds([...mountedSurfaceIds, activeSurfaceId]);
  }
  useHostedAppSidebar(activeSurfaceId);

  if (!isElectron) return null;
  return mountedSurfaceIds.map((surfaceId) => {
    const surface = hostedAppSurface(surfaceId);
    return surface === undefined ? null : (
      <HostedAppPane key={surface.id} surface={surface} active={surface.id === activeSurfaceId} />
    );
  });
}
