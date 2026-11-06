import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ChartNoAxesColumnIcon,
  MessageSquareIcon,
  PaletteIcon,
  SettingsIcon,
  ShieldIcon,
  SlidersIcon,
  SparklesIcon,
} from "lucide-react";
import { isThreadWorking } from "@t3tools/client-runtime/state/thread-inbox";
import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { readPullRequestListPreferences } from "../pullRequest/pullRequestListPreferences";
import { cn } from "../../lib/utils";
import type { RailModuleId } from "./ActivityRail";
import { useThreadShells, useProjects } from "../../state/entities";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useSidebar } from "../ui/sidebar";

interface RailFlyoutPreviewProps {
  module: RailModuleId | null;
  positionTop: number;
  open: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
}

export function RailFlyoutPreview({
  module,
  positionTop,
  open,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: RailFlyoutPreviewProps) {
  const navigate = useNavigate();
  const threads = useThreadShells();
  const projects = useProjects();
  const { setOpen } = useSidebar();

  const recentThreads = [...threads].filter((t) => !t.archivedAt && !t.deletedAt).slice(0, 4);

  const projectMap = new Map(projects.map((p) => [p.id, p.title]));

  if (!open || !module) return null;

  return (
    <div
      role="region"
      aria-label="Prévia rápida do módulo"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ top: `${Math.max(12, positionTop - 20)}px`, left: "64px" }}
      className={cn(
        "fixed z-50 w-66 rounded-xl p-2.5 gama-flyout backdrop-blur-xl",
        "bg-popover/95 border border-border/70 text-popover-foreground",
        "transition-opacity duration-150 select-none",
      )}
    >
      {/* Module = HOME (Conversas) */}
      {module === "home" && (
        <>
          <div className="flex items-center justify-between px-2 pb-2 border-b border-border/50">
            <span className="text-xs font-semibold tracking-tight">Conversas</span>
            <span className="text-2xs text-muted-foreground">{threads.length} total</span>
          </div>

          <div className="flex flex-col gap-0.5 py-1.5">
            {recentThreads.length > 0 ? (
              recentThreads.map((thread) => {
                const isWorking = isThreadWorking(thread);
                const projectName = projectMap.get(thread.projectId) ?? "Projeto";
                return (
                  <button
                    key={scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))}
                    type="button"
                    onClick={() => {
                      onClose();
                      setOpen(true);
                      void navigate({
                        to: "/$environmentId/$threadId",
                        params: {
                          environmentId: thread.environmentId,
                          threadId: thread.id,
                        },
                      });
                    }}
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-xs transition-colors cursor-pointer",
                      "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1 font-medium text-foreground">
                      {thread.title || "Sem título"}
                    </span>
                    <span className="text-3xs text-muted-foreground/80 shrink-0">
                      {projectName}
                    </span>
                    {isWorking ? (
                      <span className="size-2 rounded-full bg-gama-arc animate-ping shrink-0" />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                Nenhuma conversa recente
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              void navigate({ to: "/" });
            }}
            className="flex w-full items-center justify-between rounded-lg px-2 pt-1.5 text-xs font-medium text-gama-accent hover:opacity-80 transition-opacity cursor-pointer border-t border-border/40"
          >
            <span>Ver todas as conversas</span>
            <ArrowRightIcon className="size-3" />
          </button>
        </>
      )}

      {/* Module = PULL REQUESTS */}
      {module === "pull-requests" && (
        <>
          <div className="flex items-center gap-2 px-2 pb-2 border-b border-border/50">
            <PullRequestGlyph.pullRequest className="size-3.5 text-gama-arc" />
            <span className="text-xs font-semibold tracking-tight">Pull Requests</span>
          </div>
          <p className="px-2 py-2 text-xs text-muted-foreground leading-relaxed">
            Revise branches, diffs de código e envie revisões diretamente pelo app.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              void navigate({
                to: "/pull-requests",
                search: readPullRequestListPreferences(),
              });
            }}
            className="flex w-full items-center justify-between rounded-lg px-2 pt-1.5 text-xs font-medium text-gama-accent hover:opacity-80 transition-opacity cursor-pointer border-t border-border/40"
          >
            <span>Abrir Pull Requests</span>
            <ArrowRightIcon className="size-3" />
          </button>
        </>
      )}

      {/* Module = USAGE */}
      {module === "usage" && (
        <>
          <div className="flex items-center gap-2 px-2 pb-2 border-b border-border/50">
            <ChartNoAxesColumnIcon className="size-3.5 text-gama-arc" />
            <span className="text-xs font-semibold tracking-tight">Uso & Custos</span>
          </div>
          <p className="px-2 py-2 text-xs text-muted-foreground leading-relaxed">
            Consumo detalhado de tokens, distribuição por provedor e métricas de execução.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              void navigate({ to: "/usage" });
            }}
            className="flex w-full items-center justify-between rounded-lg px-2 pt-1.5 text-xs font-medium text-gama-accent hover:opacity-80 transition-opacity cursor-pointer border-t border-border/40"
          >
            <span>Abrir Dashboard de Uso</span>
            <ArrowRightIcon className="size-3" />
          </button>
        </>
      )}

      {/* Module = SETTINGS */}
      {module === "settings" && (
        <>
          <div className="flex items-center gap-2 px-2 pb-2 border-b border-border/50">
            <SettingsIcon className="size-3.5 text-gama-arc" />
            <span className="text-xs font-semibold tracking-tight">Configurações</span>
          </div>
          <div className="flex flex-col gap-0.5 py-1.5">
            {[
              { icon: SlidersIcon, label: "Geral", to: "/settings/general" },
              { icon: SparklesIcon, label: "Modelos & Provedores", to: "/settings/providers" },
              { icon: PaletteIcon, label: "Aparência", to: "/settings/appearance" },
              { icon: ShieldIcon, label: "Acesso & Segurança", to: "/settings/access" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  onClose();
                  void navigate({ to: item.to });
                }}
                className="flex h-7.5 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
              >
                <item.icon className="size-3.5 text-muted-foreground" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              void navigate({ to: "/settings" });
            }}
            className="flex w-full items-center justify-between rounded-lg px-2 pt-1.5 text-xs font-medium text-gama-accent hover:opacity-80 transition-opacity cursor-pointer border-t border-border/40"
          >
            <span>Ver todos os ajustes</span>
            <ArrowRightIcon className="size-3" />
          </button>
        </>
      )}
    </div>
  );
}
