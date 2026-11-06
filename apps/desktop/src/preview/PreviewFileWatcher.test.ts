// @effect-diagnostics nodeBuiltinImport:off -- The watcher under test exists to observe real inode changes.

import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { PreviewFileWatcher, filePathFromUrl } from "./PreviewFileWatcher.ts";

const directories: string[] = [];

async function makeDirectory(): Promise<string> {
  const directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-preview-watch-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => NodeFSP.rm(directory, { recursive: true, force: true })),
  );
});

function watchCounting(watcher: PreviewFileWatcher, tabId: string, file: string) {
  const state = { count: 0 };
  let wake: (() => void) | null = null;
  watcher.watch(tabId, NodeURL.pathToFileURL(file).href, () => {
    state.count += 1;
    wake?.();
    wake = null;
  });
  return {
    get count() {
      return state.count;
    },
    /** Call before the write that should trigger a reload. */
    next(): Promise<void> {
      return new Promise((resolve) => {
        wake = resolve;
      });
    },
  };
}

describe("PreviewFileWatcher", () => {
  it("reloads after the watched file is rewritten in place", async () => {
    const directory = await makeDirectory();
    const file = NodePath.join(directory, "index.html");
    await NodeFSP.writeFile(file, "<html>one</html>");
    const watcher = new PreviewFileWatcher();
    const reloads = watchCounting(watcher, "tab-1", file);
    const next = reloads.next();
    await NodeFSP.writeFile(file, "<html>two</html>");
    await next;
    expect(reloads.count).toBe(1);
    watcher.dispose();
  });

  it("keeps watching after the file is replaced by a rename", async () => {
    const directory = await makeDirectory();
    const file = NodePath.join(directory, "index.html");
    const replacement = NodePath.join(directory, "index.tmp");
    await NodeFSP.writeFile(file, "<html>one</html>");
    const watcher = new PreviewFileWatcher();
    const reloads = watchCounting(watcher, "tab-1", file);
    const replaced = reloads.next();
    await NodeFSP.writeFile(replacement, "<html>two</html>");
    await NodeFSP.rename(replacement, file);
    await replaced;
    const rewritten = reloads.next();
    await NodeFSP.writeFile(file, "<html>three</html>");
    await rewritten;
    expect(reloads.count).toBe(2);
    watcher.dispose();
  });
});

describe("filePathFromUrl", () => {
  it("returns null for remote URLs", () => {
    expect(filePathFromUrl("https://example.com/index.html")).toBeNull();
  });

  it("decodes a file URL", () => {
    expect(filePathFromUrl("file:///tmp/My%20Page.html")).toBe("/tmp/My Page.html");
  });
});
