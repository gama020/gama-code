import { useAtomValue } from "@effect/atom-react";
import * as Schema from "effect/Schema";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocation, useRouter, type AnyRouter } from "@tanstack/react-router";

import { moveWorkspaceFocus, workspaceAreaProps } from "../lib/workspaceFocus";
import { isCommandPaletteOpen } from "../commandPaletteBus";
import { isElectron } from "../env";
import {
  releaseThreadUndoShortcut,
  threadUndoClaimsShortcut,
  undoLatestThreadAction,
} from "../hooks/showThreadUndoNotice";
import { getLocalStorageItem, removeLocalStorageItem } from "../hooks/useLocalStorage";
import {
  isRichTextBoldShortcut,
  resolveShortcutCommand,
  shortcutLabelForCommand,
} from "../keybindings";
import { isEditableFocused } from "../lib/editableFocus";
import { isPreviewFocused } from "../lib/previewFocus";
import { isTerminalFocused } from "../lib/terminalFocus";
import { isModelPickerOpen } from "../modelPickerVisibility";
import { selectActiveRightPanel, useRightPanelStore } from "../rightPanelStore";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../terminalUiStateStore";
import { cn, isMacPlatform } from "../lib/utils";
import { primaryServerKeybindingsAtom } from "../state/server";
import { useEnvironmentIdentificationMode } from "../hooks/useSettings";
import {
  PanelAnimationSuppressionProvider,
  usePanelAnimationSettings,
  usePanelNavigationSuppression,
} from "../panelAnimations";
import { BackgroundThreadAnnouncer } from "./BackgroundThreadAnnouncer";
import { HistorySwipeNavigation } from "./HistorySwipeNavigation";
import { ActivityRail, type RailModuleId } from "./sidebar/ActivityRail";
import { RailFlyoutPreview } from "./sidebar/RailFlyoutPreview";
import ThreadSidebar from "./Sidebar";
import { SidebarBrandWidthProbe } from "./sidebar/SidebarChrome";
import { isAppModalPage } from "./sidebar/mainAppLocation";
import type { SidebarRouteReveal } from "./sidebar/routeReveal";
import { useSidebarStageBackdropVariant } from "./SidebarStageBackdrop";
import {
  clampThreadSidebarWidth,
  resolveInitialThreadSidebarWidth,
  resolveThreadSidebarMaximumWidth,
  resolveThreadSidebarMinimumWidth,
  THREAD_MAIN_CONTENT_MIN_WIDTH,
  THREAD_SIDEBAR_WIDTH_STORAGE_KEY,
} from "./threadSidebarWidth";
import {
  Sidebar,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
  useSidebarVisibility,
} from "./ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { appAtomRegistry } from "../rpc/atomRegistry";
import { registerCommands, registerMenuAction } from "../shortcuts/dispatcher";
import { resolveThreadRouteRef, resolveThreadRouteTarget } from "../threadRoutes";
import { ArrowLeftIcon, ArrowRightIcon, FolderIcon } from "lucide-react";
import { useCanNavigateHistory, navigateHistory } from "../navigationHistory";
import { useProjects, useThreadShells } from "../state/entities";

const MACOS_TRAFFIC_LIGHTS_LEFT_INSET = "var(--desktop-window-controls-inset, 90px)";

function subscribeToViewportWidth(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function readViewportWidth(): number {
  return window.innerWidth;
}

// Cache the synchronous fullscreen IPC read until subscription.
let windowFullscreenSnapshot: boolean | null = null;

function macosDesktopBridge() {
  if (!isElectron || !isMacPlatform(navigator.platform)) return null;
  return window.desktopBridge ?? null;
}

function subscribeToWindowFullscreen(onChange: () => void): () => void {
  const bridge = macosDesktopBridge();
  if (
    typeof bridge?.getWindowFullscreenState !== "function" ||
    typeof bridge.onWindowFullscreenStateChange !== "function"
  ) {
    return () => {};
  }
  const unsubscribe = bridge.onWindowFullscreenStateChange((fullscreen) => {
    windowFullscreenSnapshot = fullscreen;
    onChange();
  });
  // The window may have changed state between the first render and this subscription.
  windowFullscreenSnapshot = bridge.getWindowFullscreenState();
  return () => {
    unsubscribe();
    windowFullscreenSnapshot = null;
  };
}

function readWindowFullscreen(): boolean {
  if (windowFullscreenSnapshot === null) {
    const getWindowFullscreenState = macosDesktopBridge()?.getWindowFullscreenState;
    windowFullscreenSnapshot =
      typeof getWindowFullscreenState === "function" ? getWindowFullscreenState() : false;
  }
  return windowFullscreenSnapshot;
}

function readInitialThreadSidebarWidth(): number {
  try {
    return resolveInitialThreadSidebarWidth(
      getLocalStorageItem(THREAD_SIDEBAR_WIDTH_STORAGE_KEY, Schema.Finite),
      window.innerWidth,
    );
  } catch (error) {
    console.error("Could not read persisted thread sidebar width.", error);
    return resolveInitialThreadSidebarWidth(null, window.innerWidth);
  }
}

function readUsagePageOpen(router: AnyRouter) {
  return router.state.location.pathname === "/usage";
}

function isKeybindingCaptureTarget(event: KeyboardEvent) {
  return event.target instanceof HTMLElement && event.target.closest("[data-keybinding-capture]");
}

function readRoutePanelsOpen(router: AnyRouter) {
  const routeThreadRef = resolveThreadRouteRef(router.state.matches.at(-1)?.params ?? {});
  if (!routeThreadRef) return { terminalOpen: false, previewOpen: false };
  return {
    terminalOpen: selectThreadTerminalUiState(
      useTerminalUiStateStore.getState().terminalUiStateByThreadKey,
      routeThreadRef,
    ).terminalOpen,
    previewOpen:
      selectActiveRightPanel(useRightPanelStore.getState().byThreadKey, routeThreadRef) ===
      "preview",
  };
}

export function registerNavigationHistoryCommands(router: AnyRouter): () => void {
  return registerCommands(
    {
      "navigation.back": (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.history.back();
      },
      "navigation.forward": (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.history.forward();
      },
    },
    {
      when: (event) => !isKeybindingCaptureTarget(event),
      context: () => ({
        ...readRoutePanelsOpen(router),
        usagePageOpen: readUsagePageOpen(router),
      }),
    },
  );
}

// Capture phase, so F6 also leaves widgets that swallow keys, such as the terminal.
function registerWorkspaceFocusCommands(router: AnyRouter): () => void {
  const move = (direction: 1 | -1) => (event: KeyboardEvent) => {
    if (event.isComposing) return false;
    // Inside a dialog the move is refused, but the key is still consumed.
    event.preventDefault();
    event.stopPropagation();
    moveWorkspaceFocus(direction);
  };
  const disposers = [
    registerCommands(
      { "workspace.focusNext": move(1), "workspace.focusPrevious": move(-1) },
      {
        capture: true,
        when: (event) => !isKeybindingCaptureTarget(event),
        context: () => readRoutePanelsOpen(router),
      },
    ),
    // A focused desktop browser forwards the keys; its renderer focus is stale.
    registerMenuAction("workspace.focusNext", () => moveWorkspaceFocus(1, "panel")),
    registerMenuAction("workspace.focusPrevious", () => moveWorkspaceFocus(-1, "panel")),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}

// Escape leaves the pull requests page when no scope (a selection, a dialog,
// a drag) claimed it, so it observes after every other scope.
function registerPullRequestsEscapeCommand(router: AnyRouter): () => void {
  return registerCommands(
    {},
    {
      observe: (event, consumed) => {
        if (consumed || event.repeat || event.isComposing || event.key !== "Escape") return;
        if (router.state.location.pathname !== "/pull-requests") return;
        event.preventDefault();
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) activeElement.blur();
        if (router.state.location.state.__TSR_index !== 0) {
          window.history.back();
          return;
        }
        void router.navigate({ to: "/" });
      },
    },
  );
}

const MODIFIER_KEYS = new Set(["Alt", "Control", "Meta", "Shift"]);

// A held key undoes once. Module state: undoing an archive navigates, and the
// hold must survive whatever that re-renders.
let heldUndoKey: string | null = null;

// Undoes the thread actions in the sidebar's notice. Settings and Usage own
// mod+z while open. Captured so mod+z reaches it before the composer's own
// undo handler consumes the key.
function registerThreadUndoCommands(
  router: AnyRouter,
  readSidebarVisible: () => boolean,
): () => void {
  const threadSidebarShown = () => !isAppModalPage(router.state.location.pathname);
  const unregister = registerCommands(
    {},
    {
      capture: true,
      when: threadSidebarShown,
      onKeyDown: (event) => {
        // Cancel a held key's repeats so they cannot fall through to the
        // editor's own undo, even after the last notice is gone.
        if (event.repeat) {
          if (event.code !== heldUndoKey) return false;
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
        // A modifier tapped mid-hold leaves the held key repeating.
        if (!MODIFIER_KEYS.has(event.key)) heldUndoKey = null;
        const command = resolveShortcutCommand(
          event,
          appAtomRegistry.get(primaryServerKeybindingsAtom),
          {
            context: {
              terminalFocus: isTerminalFocused(),
              previewFocus: isPreviewFocused(),
              ...readRoutePanelsOpen(router),
              // A collapsed sidebar hides the notice, so text fields keep their own undo.
              editableFocus:
                isEditableFocused(event.target) &&
                !(readSidebarVisible() && threadUndoClaimsShortcut()),
              modelPickerOpen: isModelPickerOpen(),
            },
          },
        );
        if (command !== "thread.undo") {
          if (!MODIFIER_KEYS.has(event.key)) releaseThreadUndoShortcut();
          return false;
        }
        if (isCommandPaletteOpen() || isModelPickerOpen()) return false;
        if (!undoLatestThreadAction()) return false;
        heldUndoKey = event.code;
        event.preventDefault();
        event.stopPropagation();
        return true;
      },
    },
  );
  // Pastes from a menu, dictation and drops edit text without a keypress.
  const onInput = () => {
    if (threadSidebarShown()) releaseThreadUndoShortcut();
  };
  window.addEventListener("input", onInput, true);
  return () => {
    unregister();
    window.removeEventListener("input", onInput, true);
  };
}

/** Keyboard and menu commands that live as long as the app shell. */
function registerAppShellCommands(router: AnyRouter, shellElement: Element): () => void {
  // The provider mirrors the visibility it renders onto its wrapper, so the
  // committed state is readable when a key arrives.
  const readSidebarVisible = () =>
    shellElement.closest('[data-slot="sidebar-wrapper"]')?.getAttribute("data-sidebar-state") ===
    "expanded";
  const disposers = [
    registerThreadUndoCommands(router, readSidebarVisible),
    registerNavigationHistoryCommands(router),
    registerWorkspaceFocusCommands(router),
    registerPullRequestsEscapeCommand(router),
    registerMenuAction("open-settings", () => {
      if (!/^\/settings(\/|$)/.test(router.state.location.pathname))
        void router.navigate({ to: "/settings" });
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}

function SidebarControl() {
  const router = useRouter();
  const usagePageOpen = useLocation({ select: (location) => location.pathname === "/usage" });
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const { toggleSidebar, isMobile, mobileSheetMounted } = useSidebar();
  const isSidebarVisible = useSidebarVisibility();
  const environmentIdentificationMode = useEnvironmentIdentificationMode();
  const stageBackdropVariant = useSidebarStageBackdropVariant(environmentIdentificationMode);
  const shortcutLabel = shortcutLabelForCommand(keybindings, "sidebar.toggle", {
    context: { usagePageOpen },
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- window keydown listener that toggles the sidebar on its shortcut
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("[data-keybinding-capture]")
      ) {
        return;
      }
      if (
        isRichTextBoldShortcut(event, window.getSelection()) &&
        event.target instanceof HTMLElement &&
        event.target.closest('[data-composer-rich-text="true"]')
      ) {
        // The rich-text composer claims Mod+B only to bold selected text;
        // the toggle stays available everywhere else.
        return;
      }
      if (
        resolveShortcutCommand(event, keybindings, { context: { usagePageOpen } }) !==
        "sidebar.toggle"
      )
        return;

      event.preventDefault();
      event.stopPropagation();
      toggleSidebar();
    };

    window.addEventListener("keydown", onKeyDown, true);
    const unsubscribe = window.desktopBridge?.onMenuAction((action) => {
      if (action === "sidebar.toggle") toggleSidebar();
    });
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      unsubscribe?.();
    };
  }, [keybindings, toggleSidebar, usagePageOpen]);

  // The control lives as long as the shell, so it carries the shell's commands. Created
  // once so re-renders never re-register them.
  const [appShellCommandsRef] = useState(
    () => (node: HTMLDivElement | null) =>
      node === null ? undefined : registerAppShellCommands(router, node),
  );

  return (
    <div
      ref={appShellCommandsRef}
      className={cn(
        "pointer-events-none fixed z-50 flex h-[var(--workspace-topbar-height)] items-center",
        isMobile
          ? "left-[var(--workspace-controls-left)] top-[var(--workspace-controls-top)] ml-px"
          : "hidden",
        isMobile && mobileSheetMounted && "hidden",
      )}
      data-sidebar-control=""
    >
      {isMobile ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarTrigger
                variant={isSidebarVisible && stageBackdropVariant ? "media-navigation" : "ghost"}
                className={cn(
                  "pointer-events-auto",
                  isSidebarVisible && stageBackdropVariant && "relative top-auto translate-y-0",
                )}
                aria-label="Toggle main sidebar"
              />
            }
          />
          <TooltipPopup side="bottom">
            Toggle main sidebar{shortcutLabel ? ` (${shortcutLabel})` : ""}
          </TooltipPopup>
        </Tooltip>
      ) : null}
    </div>
  );
}

function AppTopTitlebar({
  isMacosDesktop,
  isWindowFullscreen,
}: {
  isMacosDesktop: boolean;
  isWindowFullscreen: boolean;
}) {
  const location = useLocation();
  const router = useRouter();
  const canGoBack = useCanNavigateHistory("back");
  const canGoForward = useCanNavigateHistory("forward");
  const threads = useThreadShells();
  const projects = useProjects();
  const activeRouteParams = router.state.matches.at(-1)?.params ?? {};
  const threadTarget = resolveThreadRouteTarget(activeRouteParams);
  const activeThreadRef = threadTarget?.kind === "server" ? threadTarget.threadRef : null;
  const activeThread = activeThreadRef
    ? (threads.find((t) => t.id === activeThreadRef.threadId) ?? null)
    : null;
  const activeProject = activeThread
    ? (projects.find((p) => p.id === activeThread.projectId) ?? null)
    : (projects.find((p) => p.title.toLowerCase().includes("creative")) ?? projects[0] ?? null);

  let projectTitle = activeProject?.title ?? "Creative OS";
  let viewTitle = activeThread?.title ?? (location.pathname === "/" ? "Home" : "Início");
  if (location.pathname === "/usage") {
    viewTitle = "Uso e Custos";
  } else if (location.pathname.startsWith("/settings")) {
    viewTitle = "Configurações";
  } else if (location.pathname.startsWith("/pull-requests")) {
    viewTitle = "Pull Requests";
  }

  return (
    <header
      className={cn(
        "hidden md:flex h-[42px] min-h-[42px] max-h-[42px] w-full shrink-0 items-center px-3 text-xs text-muted-foreground select-none z-40 bg-gama-canvas",
        isElectron && "drag-region",
      )}
    >
      {/* Native traffic lights inset on macOS Electron */}
      {isMacosDesktop && !isWindowFullscreen ? (
        <div className="w-[80px] shrink-0 pointer-events-none" aria-hidden="true" />
      ) : null}

      {/* Sidebar toggle button (Antigravity style) - Positioned immediately after traffic lights */}
      <div className="flex items-center gap-1 mr-3 [-webkit-app-region:no-drag]">
        <Tooltip>
          <TooltipTrigger render={<SidebarTrigger aria-label="Alternar painel lateral" />} />
          <TooltipPopup side="bottom">Alternar painel lateral (Cmd+B)</TooltipPopup>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={!canGoBack}
                onClick={() => navigateHistory("back")}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Voltar"
              >
                <ArrowLeftIcon className="size-3.5" />
              </button>
            }
          />
          <TooltipPopup side="bottom">Voltar</TooltipPopup>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={!canGoForward}
                onClick={() => navigateHistory("forward")}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Avançar"
              >
                <ArrowRightIcon className="size-3.5" />
              </button>
            }
          />
          <TooltipPopup side="bottom">Avançar</TooltipPopup>
        </Tooltip>
      </div>

      {/* Breadcrumbs - ONLY ONCE in the top titlebar */}
      <div className="flex items-center gap-1.5 min-w-0 max-w-[500px] [-webkit-app-region:no-drag]">
        <FolderIcon className="size-3.5 text-muted-foreground/70 shrink-0" />
        <span className="font-normal text-muted-foreground/70 truncate max-w-[140px]">
          {projectTitle}
        </span>
        <span className="text-muted-foreground/40 font-normal">/</span>
        <span className="font-semibold text-foreground truncate max-w-[280px]">{viewTitle}</span>
      </div>

      {/* Draggable spacer across the rest of the window */}
      <div className="flex-1 h-full min-w-4 drag-region" />

      {/* Right spacer reserving space for WorkspaceTitlebarControls */}
      <div className="w-32 shrink-0 pointer-events-none" aria-hidden="true" />
    </header>
  );
}

function DesktopRailWithFlyout() {
  const { state, isMobile } = useSidebar();
  const [hoveredModule, setHoveredModule] = useState<RailModuleId | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(54);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  };

  const isCollapsed = !isMobile && state === "collapsed";

  const handleHoverModule = (module: RailModuleId, targetEl: HTMLElement) => {
    if (!isCollapsed) return;
    clearTimers();
    const rect = targetEl.getBoundingClientRect();
    const top = Math.max(48, Math.min(window.innerHeight - 340, rect.top - 8));
    setFlyoutTop(top);

    if (flyoutOpen) {
      setHoveredModule(module);
    } else {
      openTimerRef.current = setTimeout(() => {
        setHoveredModule(module);
        setFlyoutOpen(true);
      }, 120);
    }
  };

  const handleLeaveModule = () => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => {
      setFlyoutOpen(false);
      setHoveredModule(null);
    }, 180);
  };

  const handleFlyoutMouseEnter = () => {
    clearTimers();
  };

  const handleFlyoutMouseLeave = () => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => {
      setFlyoutOpen(false);
      setHoveredModule(null);
    }, 150);
  };

  const handleCloseFlyout = () => {
    clearTimers();
    setFlyoutOpen(false);
    setHoveredModule(null);
  };

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- clears pending hover timers on unmount
  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <>
      <div className="hidden md:flex h-full shrink-0 z-30 mr-2">
        <ActivityRail onHoverModule={handleHoverModule} onLeaveModule={handleLeaveModule} />
      </div>
      <RailFlyoutPreview
        module={isCollapsed ? hoveredModule : null}
        positionTop={flyoutTop}
        open={flyoutOpen && isCollapsed}
        onMouseEnter={handleFlyoutMouseEnter}
        onMouseLeave={handleFlyoutMouseLeave}
        onClose={handleCloseFlyout}
      />
    </>
  );
}

export function AppSidebarLayout({ children }: { children: ReactNode }) {
  const sidebarArea = workspaceAreaProps("sidebar", 0, "Threads");
  const [sidebarRouteReveal] = useState<SidebarRouteReveal>(() => ({
    observedKey: null,
    pendingKey: null,
  }));
  const { active: panelAnimationsActive, durationMs: panelAnimationDurationMs } =
    usePanelAnimationSettings();
  const pathname = useLocation({ select: (location) => location.pathname });
  const panelAnimationsSuppressed = usePanelNavigationSuppression(pathname);
  const routePanelAnimationsActive = panelAnimationsActive && !panelAnimationsSuppressed;
  const isMacosDesktop = isElectron && isMacPlatform(navigator.platform);
  const [sidebarWidth, setSidebarWidth] = useState(readInitialThreadSidebarWidth);
  // A clamped drag may not change width, so viewport changes need a separate subscription.
  const viewportWidth = useSyncExternalStore(subscribeToViewportWidth, readViewportWidth);
  const [brandWidth, setBrandWidth] = useState(0);
  const sidebarMinimumWidth = resolveThreadSidebarMinimumWidth(brandWidth);
  const sidebarMaximumWidth = resolveThreadSidebarMaximumWidth(viewportWidth, sidebarMinimumWidth);
  const resetSidebarWidth = () => {
    try {
      removeLocalStorageItem(THREAD_SIDEBAR_WIDTH_STORAGE_KEY);
    } catch (error) {
      console.error("Could not clear persisted thread sidebar width.", error);
    }
    setSidebarWidth(resolveInitialThreadSidebarWidth(null, viewportWidth));
  };
  const isWindowFullscreen = useSyncExternalStore(
    subscribeToWindowFullscreen,
    readWindowFullscreen,
  );
  const windowControlsInsetStyle = (
    isMacosDesktop && !isWindowFullscreen
      ? { "--workspace-controls-left": MACOS_TRAFFIC_LIGHTS_LEFT_INSET }
      : {}
  ) as CSSProperties;
  const sidebarProviderStyle = {
    "--sidebar-width": `${clampThreadSidebarWidth(sidebarWidth, sidebarMinimumWidth, sidebarMaximumWidth)}px`,
    "--panel-animation-duration": `${panelAnimationDurationMs}ms`,
    ...windowControlsInsetStyle,
  } as CSSProperties;

  return (
    <PanelAnimationSuppressionProvider value={panelAnimationsSuppressed}>
      <SidebarProvider
        className="h-screen! w-screen! overflow-hidden! flex flex-col!"
        data-panel-animations={routePanelAnimationsActive ? "true" : "false"}
        defaultOpen
        style={sidebarProviderStyle}
      >
        <SidebarBrandWidthProbe isElectron={isElectron} onWidthChange={setBrandWidth} />
        <AppTopTitlebar isMacosDesktop={isMacosDesktop} isWindowFullscreen={isWindowFullscreen} />
        <div className="relative flex flex-1 min-h-0 w-full overflow-hidden p-2 pt-1">
          <DesktopRailWithFlyout />
          <Sidebar
            side="left"
            collapsible="offcanvas"
            data-app-sidebar=""
            {...sidebarArea}
            role="navigation"
            aria-label="Threads"
            resizable={{
              maxWidth: sidebarMaximumWidth,
              minWidth: sidebarMinimumWidth,
              shouldAcceptWidth: ({ currentWidth, nextWidth, wrapper }) =>
                nextWidth <= currentWidth ||
                wrapper.clientWidth - nextWidth >= THREAD_MAIN_CONTENT_MIN_WIDTH,
              storageKey: THREAD_SIDEBAR_WIDTH_STORAGE_KEY,
              onResize: setSidebarWidth,
            }}
          >
            <ThreadSidebar routeReveal={sidebarRouteReveal} />
            <SidebarRail onDoubleClick={resetSidebarWidth} />
          </Sidebar>
          <div className="flex flex-1 min-h-0 min-w-0 h-full overflow-hidden rounded-2xl border border-black/5 bg-gama-main dark:border-white/10">
            {children}
          </div>
        </div>
        <BackgroundThreadAnnouncer />
        <SidebarControl />
        {isElectron ? <HistorySwipeNavigation /> : null}
      </SidebarProvider>
    </PanelAnimationSuppressionProvider>
  );
}
