import * as Electron from "electron";

/**
 * Permissions a hosted app may ask for. Everything else (camera, microphone, geolocation, HID,
 * serial, MIDI…) is denied: the guest runs on the same machine as the agent and has no reason to
 * reach the hardware without the user asking for it directly.
 */
const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set([
  "notifications",
  "fullscreen",
  "clipboard-read",
  "clipboard-sanitized-write",
]);

const preparedSessions = new WeakSet<Electron.Session>();

/** Session-level behavior every hosted app gets: explicit permissions and a save dialog on download. */
export function prepareHostedAppSession(session: Electron.Session): void {
  if (preparedSessions.has(session)) return;
  preparedSessions.add(session);

  session.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });
  session.setPermissionCheckHandler((_contents, permission) => ALLOWED_PERMISSIONS.has(permission));

  session.on("will-download", (_event, item) => {
    // A default path would drop agency invoices and contracts in Downloads without a word.
    item.setSaveDialogOptions({ title: `Salvar ${item.getFilename()}` });
  });
}
