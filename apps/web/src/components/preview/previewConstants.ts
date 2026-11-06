export const PREVIEW_RECENT_URL_LIMIT = 10;

export const PREVIEW_ERROR_CODE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  ERR_NAME_NOT_RESOLVED: "O endereço DNS não foi encontrado",
  ERR_NAME_RESOLUTION_FAILED: "O endereço DNS não foi encontrado",
  ERR_CONNECTION_REFUSED: "O servidor recusou a conexão",
  ERR_CONNECTION_RESET: "A conexão foi reiniciada",
  ERR_CONNECTION_CLOSED: "A conexão foi fechada",
  ERR_CONNECTION_TIMED_OUT: "A conexão expirou",
  ERR_CONNECTION_FAILED: "Não foi possível conectar",
  ERR_INTERNET_DISCONNECTED: "Sem conexão com a internet",
  ERR_TIMED_OUT: "A conexão expirou",
  ERR_ADDRESS_UNREACHABLE: "O endereço está inalcançável a partir deste app",
  ERR_ADDRESS_INVALID: "O endereço é inválido",
  ERR_NETWORK_ACCESS_DENIED: "O sistema operacional negou o acesso à rede",
  ERR_NETWORK_CHANGED: "A rede mudou durante a conexão",
  ERR_EMPTY_RESPONSE: "O servidor fechou a conexão sem responder",
  ERR_CERT_AUTHORITY_INVALID: "A autoridade do certificado não é confiável",
  ERR_CERT_COMMON_NAME_INVALID: "O certificado não corresponde ao host",
  ERR_CERT_DATE_INVALID: "O certificado está expirado ou ainda não é válido",
  ERR_SSL_PROTOCOL_ERROR: "Falha no protocolo TLS",
  ERR_TOO_MANY_REDIRECTS: "Redirecionamentos demais",
  ERR_FILE_NOT_FOUND: "O arquivo não existe mais neste caminho",
  ERR_FILE_EXISTS: "Já existe um arquivo neste caminho",
  ERR_INVALID_URL: "O endereço é inválido",
  ERR_DISALLOWED_URL_SCHEME: "Este tipo de endereço não pode ser aberto aqui",
  ERR_ABORTED: "A navegação foi interrompida",
  ERR_FAILED: "A página não carregou",
});

/**
 * Chromium reports a denied socket as unreachable, not as a permission error, so macOS Local
 * Network blocking is only distinguishable by pairing these codes with a private host.
 */
export const LOCAL_NETWORK_DENIED_CODES: ReadonlySet<number> = new Set([-102, -108, -109]);

const PRIVATE_HOST_PATTERN =
  /^(?:10\.|127\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|[^.]+\.local$|localhost$|\[::1\])/;

export function isLocalNetworkHost(rawUrl: string): boolean {
  try {
    return PRIVATE_HOST_PATTERN.test(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}
