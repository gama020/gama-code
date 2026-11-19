import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";

import {
  MAX_QUOTA_RECOVERY_ATTEMPTS,
  quotaExhaustedUntil,
  quotaRecoveryBackoffMs,
  quotaRecoveryNotBefore,
  selectQuotaRecoverySelection,
} from "./QuotaRecovery.ts";

const ANTIGRAVITY = ProviderDriverKind.make("antigravity");
const nowMs = Date.parse("2026-11-17T12:00:00.000Z");
const iso = (ms: number) => DateTime.formatIso(DateTime.makeUnsafe(ms));
const inAnHour = iso(nowMs + 60 * 60 * 1000);

const snapshot = (
  id: string,
  input: {
    readonly usedPercent?: number | undefined;
    readonly models?: ReadonlyArray<string>;
  } = {},
): ServerProvider => ({
  instanceId: ProviderInstanceId.make(id),
  driver: ANTIGRAVITY,
  enabled: true,
  installed: true,
  version: "1.5.1",
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: iso(nowMs),
  models: (input.models ?? ["gemini-3-flash"]).map((slug, index) => ({
    slug,
    name: slug,
    isCustom: false,
    ...(index === 0 ? { isDefault: true } : {}),
    capabilities: null,
  })),
  slashCommands: [],
  skills: [],
  ...(input.usedPercent === undefined
    ? {}
    : {
        usageLimits: {
          checkedAt: iso(nowMs),
          windows: [
            {
              id: "weekly",
              kind: "weekly" as const,
              label: "Weekly",
              usedPercent: input.usedPercent,
              resetsAt: inAnHour,
            },
          ],
        },
      }),
});

const instance = (id: string, input?: Parameters<typeof snapshot>[1]) => ({
  instanceId: ProviderInstanceId.make(id),
  driver: ANTIGRAVITY,
  snapshot: snapshot(id, input),
});

const current = { instanceId: ProviderInstanceId.make("antigravity_01"), model: "gemini-3-flash" };

describe("selectQuotaRecoverySelection", () => {
  it("rotates to another ready account when the current one is exhausted", () => {
    const selection = selectQuotaRecoverySelection({
      instances: [
        instance("antigravity_01", { usedPercent: 100 }),
        instance("antigravity_02", { usedPercent: 10 }),
      ],
      current,
      driver: ANTIGRAVITY,
      exhaustedUntil: new Map([[current.instanceId, nowMs + 60 * 60 * 1000]]),
      nowMs,
    });
    assert.deepEqual(selection, {
      kind: "switch",
      modelSelection: {
        instanceId: ProviderInstanceId.make("antigravity_02"),
        model: "gemini-3-flash",
      },
    });
  });

  it("uses the target account's default model when it does not offer the old one", () => {
    const selection = selectQuotaRecoverySelection({
      instances: [
        instance("antigravity_01", { usedPercent: 100 }),
        instance("antigravity_02", { usedPercent: 10, models: ["gemini-2-flash"] }),
      ],
      current,
      driver: ANTIGRAVITY,
      exhaustedUntil: new Map(),
      nowMs,
    });
    assert.equal(selection.kind, "switch");
    assert.equal(
      selection.kind === "switch" ? selection.modelSelection.model : undefined,
      "gemini-2-flash",
    );
  });

  it("reports every account exhausted instead of picking one again", () => {
    const selection = selectQuotaRecoverySelection({
      instances: [
        instance("antigravity_01", { usedPercent: 100 }),
        instance("antigravity_02", { usedPercent: 100 }),
      ],
      current,
      driver: ANTIGRAVITY,
      exhaustedUntil: new Map(),
      nowMs,
    });
    assert.equal(selection.kind, "exhausted");
  });

  it("keeps waiting for a single account's reset", () => {
    const selection = selectQuotaRecoverySelection({
      instances: [instance("antigravity_01", { usedPercent: 100 })],
      current,
      driver: ANTIGRAVITY,
      exhaustedUntil: new Map(),
      nowMs,
    });
    assert.equal(selection.kind, "current");
  });
});

describe("quotaRecoveryNotBefore", () => {
  it("resumes at the reset first, then honours the attempt's backoff", () => {
    const resetAtMs = nowMs + 120_000;
    assert.equal(
      quotaRecoveryNotBefore({ attempt: 0, lastAtMs: nowMs, resetAtMs, seed: "thread:run" }),
      resetAtMs,
    );
    const first = quotaRecoveryNotBefore({
      attempt: 1,
      lastAtMs: nowMs,
      resetAtMs: nowMs,
      seed: "thread:run",
    });
    assert.isAtLeast(first, nowMs + 60_000);
    assert.isBelow(first, nowMs + 75_000);
    const second = quotaRecoveryNotBefore({
      attempt: 2,
      lastAtMs: nowMs,
      resetAtMs: nowMs,
      seed: "thread:run",
    });
    assert.isAtLeast(second, nowMs + 120_000);
    assert.equal(
      quotaRecoveryNotBefore({
        attempt: 1,
        lastAtMs: nowMs,
        resetAtMs: nowMs + 10 * 60_000,
        seed: "thread:run",
      }),
      nowMs + 10 * 60_000,
    );
  });
});

describe("quotaRecoveryBackoffMs", () => {
  it("grows exponentially, keeps jitter, and caps", () => {
    const first = quotaRecoveryBackoffMs(1, "thread:run");
    const second = quotaRecoveryBackoffMs(2, "thread:run");
    const capped = quotaRecoveryBackoffMs(MAX_QUOTA_RECOVERY_ATTEMPTS + 10, "thread:run");
    assert.isAtLeast(first, 60_000);
    assert.isBelow(first, 75_000);
    assert.isAtLeast(second, 120_000);
    assert.isBelow(second, 150_000);
    assert.isAtLeast(capped, 10 * 60 * 1000);
    assert.isBelow(capped, 12.5 * 60 * 1000);
    assert.notEqual(
      quotaRecoveryBackoffMs(1, "thread:one"),
      quotaRecoveryBackoffMs(1, "thread:two"),
    );
  });

  it("caps a reported reset window", () => {
    const week = iso(nowMs + 7 * 24 * 60 * 60 * 1000);
    assert.equal(quotaExhaustedUntil(week, nowMs), nowMs + 6 * 60 * 60 * 1000);
    assert.isNull(quotaExhaustedUntil(iso(nowMs - 1), nowMs));
  });
});
