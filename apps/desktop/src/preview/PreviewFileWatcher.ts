// @effect-diagnostics nodeBuiltinImport:off -- Effect's FileSystem has no watch primitive, and this watcher has to observe inode changes made by other processes.
// @effect-diagnostics globalTimers:off -- The debounce coalesces native fs.watch callbacks that arrive outside any Effect fiber.

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

/** Coalesce the burst of writes an editor or agent makes while saving one file. */
const PREVIEW_FILE_WATCH_DEBOUNCE_MS = 350;

interface WatchedFile {
  readonly filePath: string;
  readonly watcher: NodeFS.FSWatcher;
  signature: string | null;
  timer: NodeJS.Timeout | null;
}

/**
 * Reloads a `file://` preview when the file on disk changes. Watches the parent directory
 * because an editor or agent that replaces the inode would leave a file watcher silent;
 * the reload decision compares the file's own mtime/size.
 */
export class PreviewFileWatcher {
  readonly #files = new Map<string, WatchedFile>();

  watch(tabId: string, url: string, onChange: () => void): void {
    const filePath = filePathFromUrl(url);
    if (filePath === null) {
      this.unwatch(tabId);
      return;
    }
    const current = this.#files.get(tabId);
    if (current?.filePath === filePath) return;
    this.unwatch(tabId);
    let watcher: NodeFS.FSWatcher;
    try {
      watcher = NodeFS.watch(NodePath.dirname(filePath), { persistent: false });
    } catch {
      // A deleted directory or a sandbox denial leaves the tab without live reload.
      return;
    }
    const entry: WatchedFile = {
      filePath,
      watcher,
      signature: signatureOf(filePath),
      timer: null,
    };
    const schedule = () => {
      if (entry.timer !== null) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        entry.timer = null;
        const next = signatureOf(filePath);
        if (next === null || next === entry.signature) return;
        entry.signature = next;
        onChange();
      }, PREVIEW_FILE_WATCH_DEBOUNCE_MS);
    };
    watcher.on("change", schedule);
    watcher.on("error", () => this.unwatch(tabId));
    this.#files.set(tabId, entry);
  }

  unwatch(tabId: string): void {
    const entry = this.#files.get(tabId);
    if (entry === undefined) return;
    if (entry.timer !== null) clearTimeout(entry.timer);
    entry.watcher.close();
    this.#files.delete(tabId);
  }

  dispose(): void {
    for (const tabId of this.#files.keys()) this.unwatch(tabId);
  }
}

function signatureOf(filePath: string): string | null {
  try {
    const stat = NodeFS.statSync(filePath);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return null;
  }
}

export function filePathFromUrl(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  try {
    return NodeURL.fileURLToPath(url);
  } catch {
    return null;
  }
}

export const previewFileWatcher = new PreviewFileWatcher();
