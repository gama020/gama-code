import type {
  ModelSelection,
  ProviderDriverKind,
  ProviderInstanceId,
  ServerProvider,
} from "@t3tools/contracts";

/**
 * Picks the account a usage-limited turn resumes on and bounds the retries that
 * keep it on the same one. A reported reset is capped so a stale window cannot
 * pin an account out of rotation for a week.
 */
const QUOTA_EXHAUSTION_CEILING_MS = 6 * 60 * 60 * 1000;
export const MAX_QUOTA_RECOVERY_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 60 * 1000;
const MAX_BACKOFF_MS = 10 * 60 * 1000;

export interface QuotaRecoveryInstance {
  readonly instanceId: ProviderInstanceId;
  readonly driver: ProviderDriverKind;
  readonly snapshot: ServerProvider;
}

type QuotaRecoverySelection =
  | { readonly kind: "current" }
  | { readonly kind: "switch"; readonly modelSelection: ModelSelection }
  | { readonly kind: "exhausted" };

/** How long a refused account stays out of rotation; nothing when the reset already passed. */
export function quotaExhaustedUntil(resetAt: string, nowMs: number): number | null {
  const resetMs = Date.parse(resetAt);
  if (!Number.isFinite(resetMs) || resetMs <= nowMs) return null;
  return Math.min(resetMs, nowMs + QUOTA_EXHAUSTION_CEILING_MS);
}

/** Exponential backoff with deterministic jitter, so a loop cannot retry in lockstep. */
export function quotaRecoveryBackoffMs(attempt: number, seed: string): number {
  const capped = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1));
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return capped + (Math.abs(hash) % Math.max(1, Math.floor(capped / 4)));
}

/** The first resume honours the reset; later ones also honour the attempt's backoff. */
export function quotaRecoveryNotBefore(input: {
  readonly attempt: number;
  readonly lastAtMs: number;
  readonly resetAtMs: number;
  readonly seed: string;
}): number {
  return input.attempt === 0
    ? input.resetAtMs
    : Math.max(input.resetAtMs, input.lastAtMs + quotaRecoveryBackoffMs(input.attempt, input.seed));
}

const providerIsReady = (snapshot: ServerProvider) =>
  snapshot.enabled &&
  snapshot.installed &&
  snapshot.status === "ready" &&
  snapshot.availability !== "unavailable";

/** A probe that names an exhausted window is evidence the account cannot take a turn. */
function providerHasQuota(snapshot: ServerProvider, nowMs: number): boolean {
  if (snapshot.usageLimits?.zeroSpendCap === true) return false;
  return !(snapshot.usageLimits?.windows ?? []).some((window) => {
    if (window.usedPercent < 100) return false;
    const resetMs = window.resetsAt === undefined ? Number.NaN : Date.parse(window.resetsAt);
    return !Number.isFinite(resetMs) || resetMs > nowMs;
  });
}

const modelForInstance = (snapshot: ServerProvider, model: string): string =>
  snapshot.models.length === 0 || snapshot.models.some((entry) => entry.slug === model)
    ? model
    : (snapshot.models.find((entry) => entry.isDefault)?.slug ?? snapshot.models[0]!.slug);

/**
 * Keeps the current account while it can take the turn; otherwise hands the
 * turn to another ready account of the same driver. Reports `exhausted` only
 * when another account exists, so a single-account setup still waits for reset.
 */
export function selectQuotaRecoverySelection(input: {
  readonly instances: ReadonlyArray<QuotaRecoveryInstance>;
  readonly current: ModelSelection;
  readonly driver: ProviderDriverKind | undefined;
  readonly exhaustedUntil: ReadonlyMap<ProviderInstanceId, number>;
  readonly nowMs: number;
}): QuotaRecoverySelection {
  if (input.driver === undefined) return { kind: "current" };
  const sameDriver = input.instances.filter(
    (entry) => entry.driver === input.driver && providerIsReady(entry.snapshot),
  );
  const available = sameDriver
    .filter(
      (entry) =>
        (input.exhaustedUntil.get(entry.instanceId) ?? 0) <= input.nowMs &&
        providerHasQuota(entry.snapshot, input.nowMs),
    )
    .toSorted((left, right) => String(left.instanceId).localeCompare(String(right.instanceId)));
  const current = sameDriver.find((entry) => entry.instanceId === input.current.instanceId);
  if (current !== undefined && available.some((entry) => entry.instanceId === current.instanceId)) {
    return { kind: "current" };
  }
  const target = available.find((entry) => entry.instanceId !== input.current.instanceId);
  if (target !== undefined) {
    return {
      kind: "switch",
      modelSelection: {
        instanceId: target.instanceId,
        model: modelForInstance(target.snapshot, input.current.model),
      },
    };
  }
  // Without another usable account there is nothing to rotate to; the reset wait stands.
  return sameDriver.some((entry) => entry.instanceId !== input.current.instanceId)
    ? { kind: "exhausted" }
    : { kind: "current" };
}
