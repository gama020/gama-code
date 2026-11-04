import {
  PREVIEW_ERROR_CODE_MESSAGES,
  LOCAL_NETWORK_DENIED_CODES,
  isLocalNetworkHost,
} from "./previewConstants";

export function describePreviewError(description: string): string {
  const friendly = PREVIEW_ERROR_CODE_MESSAGES[description];
  if (friendly) return friendly;
  if (description.length > 0) return description;
  return "Network error";
}

/** Chromium and the system report a denied local-network socket the same way they report a dead host. */
const isMacClient = () =>
  typeof navigator !== "undefined" && navigator.userAgent.includes("Macintosh");

export function localNetworkHint(input: {
  readonly url: string;
  readonly code: number;
  readonly description: string;
  readonly isMacosClient?: boolean;
}): string | null {
  if (!(input.isMacosClient ?? isMacClient()) || !isLocalNetworkHost(input.url)) return null;
  const denied =
    LOCAL_NETWORK_DENIED_CODES.has(input.code) ||
    input.description === "ERR_ADDRESS_UNREACHABLE" ||
    input.description === "ERR_NETWORK_ACCESS_DENIED";
  if (!denied) return null;
  return "O macOS bloqueia apps sem permissão de Rede Local, e esse bloqueio aparece como endereço inalcançável. Outros navegadores funcionam porque já foram autorizados. Autorize o app em Ajustes do Sistema → Privacidade e Segurança → Rede Local e recarregue.";
}
