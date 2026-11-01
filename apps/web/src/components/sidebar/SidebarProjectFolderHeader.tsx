import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "~/lib/utils";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { useUiStateStore } from "../../uiStateStore";
import { resolveSidebarFolderDot, resolveThreadLastVisitedAt } from "../Sidebar.logic";
import { ProjectFavicon } from "../ProjectFavicon";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useTranslation } from "../../i18n";

const FOLDER_DOT_CLASS_NAME = {
  attention: "bg-warning ring-2 ring-warning/30",
  failed: "bg-error",
  unread: "bg-success",
  working: "bg-info animate-pulse ring-2 ring-info/30",
} as const;

const FOLDER_DOT_LABEL = {
  attention: ", precisa de atenção",
  failed: ", falhou",
  unread: ", concluído",
  working: ", trabalhando",
} as const;

/** The folder's sidebar tree row; its thread rows name it as their parent. */
export function sidebarFolderRowId(projectKey: string) {
  return `folder:${projectKey}`;
}

/**
 * A project folder in the boring sidebar. It reads like a shelf header: a trailing
 * count and chevron, with the count and a status dot only while it is closed, so a
 * closed folder still says when a hidden thread needs you.
 */
export const SidebarProjectFolderHeader = memo(function SidebarProjectFolderHeader(props: {
  group: SidebarProjectSnapshot;
  collapsed: boolean;
  hiddenThreads: readonly EnvironmentThreadShell[];
  totalThreadsCount?: number;
  onToggle: (group: SidebarProjectSnapshot) => void;
  onNewThread: (group: SidebarProjectSnapshot) => void;
  onContextMenu: (group: SidebarProjectSnapshot, position: { x: number; y: number }) => void;
}) {
  const { group, collapsed, hiddenThreads, totalThreadsCount } = props;
  const rowId = sidebarFolderRowId(group.projectKey);
  const localLastVisitedAtById = useUiStateStore((state) => state.threadLastVisitedAtById);
  const dot = collapsed
    ? resolveSidebarFolderDot(
        hiddenThreads.map((thread) => ({
          ...thread,
          lastVisitedAt: resolveThreadLastVisitedAt(
            thread.lastVisitedAt,
            localLastVisitedAtById[
              scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))
            ],
          ),
        })),
      )
    : null;
  const { t } = useTranslation();
  const newThreadInFolderText = t(
    "sidebar.newThreadInProjectNamed",
    `Nova conversa em ${group.displayName}`,
    { name: group.displayName },
  );
  const totalCount = totalThreadsCount ?? (collapsed ? hiddenThreads.length : 0);

  return (
    <li
      data-testid="sidebar-project-folder"
      className="group/project-folder relative mt-2.5 list-none first:mt-0"
    >
      <button
        type="button"
        role="treeitem"
        tabIndex={-1}
        data-sidebar-row={rowId}
        aria-expanded={!collapsed}
        onClick={() => props.onToggle(group)}
        onContextMenu={(event) => {
          event.preventDefault();
          props.onContextMenu(group, { x: event.clientX, y: event.clientY });
        }}
        className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left outline-none transition-colors hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-sidebar-muted-foreground transition-transform duration-150",
            collapsed && "-rotate-90",
          )}
        />
        <ProjectFavicon project={group} className="size-4 shrink-0 rounded" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/80 group-hover/project-folder:text-sidebar-foreground">
          {group.displayName}
        </span>
        {dot ? (
          <span className={cn("size-2 shrink-0 rounded-full", FOLDER_DOT_CLASS_NAME[dot])}>
            <span className="sr-only">{FOLDER_DOT_LABEL[dot]}</span>
          </span>
        ) : null}
        {totalCount > 0 ? (
          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-3xs font-medium tabular-nums text-sidebar-muted-foreground bg-sidebar-border/40 group-hover/project-folder:opacity-0 pointer-coarse:opacity-0 transition-opacity">
            {totalCount}
          </span>
        ) : null}
      </button>
      <span className="absolute inset-y-0 right-1.5 flex items-center opacity-0 focus-within:opacity-100 group-hover/project-folder:opacity-100 pointer-coarse:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-sidebar-action-for={rowId}
                size="icon-xs"
                variant="ghost-muted"
                aria-label={newThreadInFolderText}
                onClick={() => props.onNewThread(group)}
              />
            }
          >
            <PlusIcon className="size-3.5" aria-hidden />
          </TooltipTrigger>
          <TooltipPopup>{newThreadInFolderText}</TooltipPopup>
        </Tooltip>
      </span>
    </li>
  );
});
