import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  ChartNoAxesColumnIcon,
  HelpCircleIcon,
  MessageSquareIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { isThreadWorking } from "@t3tools/client-runtime/state/thread-inbox";
import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { readPullRequestListPreferences } from "../pullRequest/pullRequestListPreferences";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useSidebar } from "../ui/sidebar";
import { useThreadShells, useProjects } from "../../state/entities";
import { usePullRequestsSupported } from "../../state/environments";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { openCommandPalette } from "../../commandPaletteBus";

export type RailModuleId = "home" | "pull-requests" | "usage" | "settings";

interface ActivityRailProps {
  onHoverModule?: (module: RailModuleId, targetEl: HTMLElement) => void;
  onLeaveModule?: () => void;
  className?: string;
}

export function ActivityRail({ onHoverModule, onLeaveModule, className }: ActivityRailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const threads = useThreadShells();
  const projects = useProjects();
  const pullRequestsSupported = usePullRequestsSupported();
  const handleNewThread = useNewThreadHandler();
  const { open, setOpen } = useSidebar();

  // Detect whether any background agent/thread is actively running
  const hasActiveWorkingThread = threads.some((thread) => isThreadWorking(thread));

  const mostRecentProject = projects.find((project) => project.archivedAt == null) ?? null;

  const handleStartNewChat = () => {
    if (!open) setOpen(true);
    if (mostRecentProject) {
      const projectRef = scopeProjectRef(mostRecentProject.environmentId, mostRecentProject.id);
      void handleNewThread(projectRef);
    } else {
      void navigate({ to: "/" });
    }
  };

  const isHomeActive = pathname === "/" || pathname.startsWith("/_chat");
  const isPrActive = pathname.startsWith("/pull-requests");
  const isUsageActive = pathname.startsWith("/usage");
  const isSettingsActive = pathname.startsWith("/settings");

  return (
    <aside
      data-slot="activity-rail"
      aria-label="Barra de Atividades"
      className={cn(
        "relative z-30 flex h-full w-14 shrink-0 flex-col items-center py-2 select-none",
        "gama-rail text-white rounded-2xl ring-1 ring-white/10",
        className,
      )}
    >
      {/* Brand Icon (Squircle Apple-HIG) */}
      <div className="mb-2.5 grid size-7.5 place-items-center">
        <Link
          to="/"
          aria-label="Gama Os Início"
          className="grid size-7.5 place-items-center rounded-lg overflow-hidden transition-transform hover:scale-105 active:scale-95"
        >
          <img
            src="/favicon-32x32.png"
            alt="Gama Os"
            className="size-5.5 rounded-md object-cover ring-1 ring-white/20 shadow-xs"
          />
        </Link>
      </div>

      {/* Primary Navigation Modules */}
      <nav className="flex flex-col items-center gap-1" aria-label="Módulos Principais">
        {/* Conversas (Home) */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                data-active={isHomeActive}
                aria-label="Conversas e Projetos"
                onClick={() => {
                  if (!open) {
                    setOpen(true);
                  }
                }}
                onMouseEnter={(e) => onHoverModule?.("home", e.currentTarget)}
                onMouseLeave={onLeaveModule}
                className={cn(
                  "relative grid size-9.5 place-items-center rounded-xl transition-all duration-150 cursor-pointer",
                  "text-gama-muted hover:bg-white/5 hover:text-gama-hover",
                  isHomeActive && "bg-white/10 text-white font-medium shadow-xs",
                )}
              >
                <MessageSquareIcon className={cn("size-4.5", isHomeActive && "text-gama-arc")} />
                {hasActiveWorkingThread && (
                  <span
                    className="absolute top-2 right-2 size-2.5 text-gama-arc"
                    aria-label="Agente executando"
                  >
                    <svg className="size-full animate-spin" viewBox="0 0 16 16" fill="none">
                      <circle
                        cx="8"
                        cy="8"
                        r="5.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeDasharray="23 12"
                      />
                    </svg>
                  </span>
                )}
              </button>
            }
          />
          <TooltipPopup side="right">Conversas e Projetos</TooltipPopup>
        </Tooltip>

        {/* Pull Requests */}
        {pullRequestsSupported ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  data-active={isPrActive}
                  aria-label="Pull Requests"
                  onClick={() => {
                    if (!open) setOpen(true);
                    void navigate({
                      to: "/pull-requests",
                      search: readPullRequestListPreferences(),
                    });
                  }}
                  onMouseEnter={(e) => onHoverModule?.("pull-requests", e.currentTarget)}
                  onMouseLeave={onLeaveModule}
                  className={cn(
                    "relative grid size-9.5 place-items-center rounded-xl transition-all duration-150 cursor-pointer",
                    "text-gama-muted hover:bg-white/5 hover:text-gama-hover",
                    isPrActive && "bg-white/10 text-white font-medium shadow-xs",
                  )}
                >
                  <PullRequestGlyph.pullRequest
                    className={cn("size-4.5", isPrActive && "text-gama-arc")}
                  />
                </button>
              }
            />
            <TooltipPopup side="right">Pull Requests</TooltipPopup>
          </Tooltip>
        ) : null}

        {/* Uso de Tokens */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                data-active={isUsageActive}
                aria-label="Uso de Tokens"
                onClick={() => {
                  if (!open) setOpen(true);
                  void navigate({ to: "/usage" });
                }}
                onMouseEnter={(e) => onHoverModule?.("usage", e.currentTarget)}
                onMouseLeave={onLeaveModule}
                className={cn(
                  "relative grid size-9.5 place-items-center rounded-xl transition-all duration-150 cursor-pointer",
                  "text-gama-muted hover:bg-white/5 hover:text-gama-hover",
                  isUsageActive && "bg-white/10 text-white font-medium shadow-xs",
                )}
              >
                <ChartNoAxesColumnIcon
                  className={cn("size-4.5", isUsageActive && "text-gama-arc")}
                />
              </button>
            }
          />
          <TooltipPopup side="right">Uso e Custos</TooltipPopup>
        </Tooltip>

        {/* Separador */}
        <div className="my-2 h-0 w-5.5 border-t border-white/10" />

        {/* Ação Primária: Novo Chat */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Nova Conversa"
                onClick={handleStartNewChat}
                className={cn(
                  "relative grid size-9.5 place-items-center rounded-xl transition-all duration-150 cursor-pointer",
                  "bg-gama-accent/15 text-gama-arc hover:bg-gama-accent/25 hover:text-white",
                  "ring-1 ring-gama-accent/30 hover:ring-gama-accent/50 shadow-xs active:scale-95",
                )}
              >
                <PlusIcon className="size-4.5 stroke-2" />
              </button>
            }
          />
          <TooltipPopup side="right">Novo Chat (Cmd+N)</TooltipPopup>
        </Tooltip>
      </nav>

      {/* Bottom Utility Items */}
      <div className="mt-auto flex flex-col items-center gap-1 pt-2" aria-label="Ações de Suporte">
        {/* Ajustes */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                data-active={isSettingsActive}
                aria-label="Configurações"
                onClick={() => {
                  if (!open) setOpen(true);
                  void navigate({ to: "/settings" });
                }}
                onMouseEnter={(e) => onHoverModule?.("settings", e.currentTarget)}
                onMouseLeave={onLeaveModule}
                className={cn(
                  "relative grid size-9.5 place-items-center rounded-xl transition-all duration-150 cursor-pointer",
                  "text-gama-muted hover:bg-white/5 hover:text-gama-hover",
                  isSettingsActive && "bg-white/10 text-white font-medium shadow-xs",
                )}
              >
                <SettingsIcon className={cn("size-4.5", isSettingsActive && "text-gama-arc")} />
              </button>
            }
          />
          <TooltipPopup side="right">Configurações</TooltipPopup>
        </Tooltip>

        {/* Ajuda / Atalhos */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Paleta de Comandos e Atalhos"
                onClick={() => openCommandPalette()}
                className="grid size-9.5 place-items-center rounded-xl text-gama-muted transition-all duration-150 hover:bg-white/5 hover:text-gama-hover cursor-pointer"
              >
                <HelpCircleIcon className="size-4.5" />
              </button>
            }
          />
          <TooltipPopup side="right">Atalhos e Comandos (Cmd+K)</TooltipPopup>
        </Tooltip>

        {/* User Avatar */}
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="mt-2.5 grid size-6.5 place-items-center rounded-full gama-avatar text-2xs font-semibold ring-1 ring-white/15 select-none shadow-xs cursor-default">
                G
              </div>
            }
          />
          <TooltipPopup side="right">Perfil Gama</TooltipPopup>
        </Tooltip>
      </div>
    </aside>
  );
}
