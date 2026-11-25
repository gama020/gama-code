import { T, useGT, useMessages, Var } from "gt-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";

import { describePreviewError, localNetworkHint } from "./errorCodeMessages";

interface Props {
  url: string;
  code: number;
  description: string;
  onReload: () => void;
  onOpenInBrowser?: (() => void) | undefined;
  onOpenLocalNetworkSettings?: (() => void) | undefined;
  move?: { readonly label: string; readonly onMove: () => void };
}

export function PreviewFileNotShown({
  url,
  fileName,
  downloadUrl,
  onOpen,
}: {
  url: string;
  fileName: string;
  downloadUrl: string | null;
  onOpen: () => void;
}) {
  const host = safeHost(url) ?? url;
  return (
    <div className="scrollbar-gutter-both relative flex h-full min-h-0 w-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-8 py-12 sm:py-16">
        <ErrorIcon className="mb-6 size-12 text-muted-foreground/70" />
        <h1 className="mb-3 text-2xl font-semibold leading-tight text-foreground">
          <T>This file can&rsquo;t be shown here</T>
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <T>
            <span className="font-semibold text-foreground">
              <Var>{fileName}</Var>
            </span>{" "}
            from <Var>{host}</Var> was downloaded instead.
          </T>
        </p>
        <div className="mt-auto flex items-center gap-2 pt-8">
          <div className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={onOpen}>
            <T>Open in browser</T>
          </Button>
          {downloadUrl ? (
            <Button type="button" size="sm" render={<a href={downloadUrl} download={fileName} />}>
              <T context="verb">Download</T>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PreviewUnreachable({
  url,
  code,
  description,
  onReload,
  onOpenInBrowser,
  onOpenLocalNetworkSettings,
  move,
}: Props) {
  const gt = useGT();
  const m = useMessages();
  const [showDetails, setShowDetails] = useState(false);
  const host = previewTargetLabel(url);
  const friendly = describePreviewError(description, m);
  const errorLabel = description.length > 0 ? description : `ERR_${Math.abs(code) || "FAILED"}`;
  const networkHint = localNetworkHint({ url, code, description }, m);

  return (
    <div className="scrollbar-gutter-both relative flex h-full min-h-0 w-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-8 py-12 sm:py-16">
        <ErrorIcon className="mb-6 size-12 text-muted-foreground/70" />
        <h1 className="mb-3 text-2xl font-semibold leading-tight text-foreground">
          <T>This site can&rsquo;t be reached</T>
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <T>
            <span className="font-semibold text-foreground">
              <Var>{host}</Var>
            </span>
            : <Var>{friendly}</Var>.
          </T>
        </p>

        {networkHint ? (
          <div className="mt-6 rounded-lg border border-warning/40 bg-warning-surface p-4 text-sm">
            <p className="mb-1 font-medium text-foreground">
              <T>Local network blocked</T>
            </p>
            <p className="leading-relaxed text-muted-foreground">{networkHint}</p>
            {onOpenLocalNetworkSettings ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenLocalNetworkSettings}
                >
                  <T>Open Local Network settings</T>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {showDetails ? (
          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="mb-2 font-medium text-foreground">
              <T>Try:</T>
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                <T>Checking your connection</T>
              </li>
              <li>
                <T>Confirming the dev server is running</T>
              </li>
              {move ? (
                <li>
                  <T>Opening it in the environment&rsquo;s browser, which reaches its network</T>
                </li>
              ) : null}
              <li>
                <T>Checking the proxy and the firewall</T>
              </li>
            </ul>
          </div>
        ) : null}

        <div className="mt-8 text-xs uppercase tracking-wide text-muted-foreground/70">
          {errorLabel}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-8">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDetails((value) => !value)}
          >
            {showDetails ? gt("Hide details") : gt("Details")}
          </Button>
          <div className="flex-1" />
          {onOpenInBrowser ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenInBrowser}>
              <T>Open in browser</T>
            </Button>
          ) : null}
          {move ? (
            <Button type="button" variant="outline" size="sm" onClick={move.onMove}>
              {move.label}
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={onReload}>
            <T>Reload</T>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={className}
    >
      <path d="M16 12 L48 12 L48 52 L16 52 Z" />
      <path d="M22 22 L42 22 M22 30 L36 30 M22 38 L40 38" strokeLinecap="round" />
      <path d="M52 8 L12 56" strokeLinecap="round" />
    </svg>
  );
}

function safeHost(url: string): string | null {
  try {
    const host = new URL(url).host;
    return host.length > 0 ? host : null;
  } catch {
    return null;
  }
}

/**
 * A `file://` URL has no host, so the error card used to print an empty label and hide the one
 * detail that matters: which file went missing.
 */
function previewTargetLabel(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") {
      try {
        return decodeURIComponent(parsed.pathname);
      } catch {
        return parsed.pathname;
      }
    }
    return parsed.host.length > 0 ? parsed.host : url;
  } catch {
    return url;
  }
}
