import { msg } from "gt-react";

export const PREVIEW_RECENT_URL_LIMIT = 10;

export const PREVIEW_ERROR_CODE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  ERR_NAME_NOT_RESOLVED: msg("DNS address could not be found"),
  ERR_NAME_RESOLUTION_FAILED: msg("DNS address could not be found"),
  ERR_CONNECTION_REFUSED: msg("Connection refused"),
  // Another environment's localhost tab, when its tunnel or the port on that machine is unreachable.
  ERR_SOCKS_CONNECTION_FAILED: msg("Could not reach this port on the environment"),
  ERR_CONNECTION_RESET: msg("Connection was reset"),
  ERR_CONNECTION_CLOSED: msg("Connection was closed"),
  ERR_CONNECTION_TIMED_OUT: msg("Connection timed out"),
  ERR_CONNECTION_FAILED: msg("Could not connect"),
  ERR_INTERNET_DISCONNECTED: msg("No internet connection"),
  ERR_TIMED_OUT: msg("Connection timed out"),
  ERR_ADDRESS_UNREACHABLE: msg("The address is unreachable from this app"),
  ERR_ADDRESS_INVALID: msg("The address is invalid"),
  ERR_NETWORK_ACCESS_DENIED: msg("The operating system denied network access"),
  ERR_NETWORK_CHANGED: msg("The network changed during the connection"),
  ERR_EMPTY_RESPONSE: msg("The server closed the connection without responding"),
  ERR_CERT_AUTHORITY_INVALID: msg("Certificate authority is not trusted"),
  ERR_CERT_COMMON_NAME_INVALID: msg("Certificate hostname mismatch"),
  ERR_CERT_DATE_INVALID: msg("Certificate is expired or not yet valid"),
  ERR_SSL_PROTOCOL_ERROR: msg("TLS protocol failure"),
  ERR_TOO_MANY_REDIRECTS: msg("Too many redirects"),
  ERR_FILE_NOT_FOUND: msg("This file no longer exists at this path"),
  ERR_FILE_EXISTS: msg("A file already exists at this path"),
  ERR_INVALID_URL: msg("The address is invalid"),
  ERR_DISALLOWED_URL_SCHEME: msg("This kind of address can't be opened here"),
  ERR_ABORTED: msg("Navigation was interrupted"),
  ERR_FAILED: msg("The page didn't load"),
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
