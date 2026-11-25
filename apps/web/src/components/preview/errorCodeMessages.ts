import { msg } from "gt-react";

import { m, type MessageResolver } from "~/i18n/messages";
import {
  isLocalNetworkHost,
  LOCAL_NETWORK_DENIED_CODES,
  PREVIEW_ERROR_CODE_MESSAGES,
} from "./previewConstants";

/** Components pass `useMessages()` so the message follows a language switch. */
export function describePreviewError(description: string, resolve: MessageResolver = m): string {
  const friendly = PREVIEW_ERROR_CODE_MESSAGES[description];
  if (friendly) return resolve(friendly);
  if (description.length > 0) return description;
  return resolve(msg("Network error"));
}

/** Chromium and the system report a denied local-network socket the same way they report a dead host. */
const isMacClient = () =>
  typeof navigator !== "undefined" && navigator.userAgent.includes("Macintosh");

export function localNetworkHint(
  input: {
    readonly url: string;
    readonly code: number;
    readonly description: string;
    readonly isMacosClient?: boolean;
  },
  resolve: MessageResolver = m,
): string | null {
  if (!(input.isMacosClient ?? isMacClient()) || !isLocalNetworkHost(input.url)) return null;
  const denied =
    LOCAL_NETWORK_DENIED_CODES.has(input.code) ||
    input.description === "ERR_ADDRESS_UNREACHABLE" ||
    input.description === "ERR_NETWORK_ACCESS_DENIED";
  if (!denied) return null;
  return resolve(
    msg(
      "macOS blocks apps that lack Local Network permission, and this block looks like an unreachable address. Other browsers work because they were already approved. Allow the app in System Settings → Privacy & Security → Local Network, then reload.",
    ),
  );
}
