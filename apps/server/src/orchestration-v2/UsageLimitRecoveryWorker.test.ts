import { assert, describe, it } from "@effect/vitest";
import {
  CommandId,
  ProviderDriverKind,
  ProviderInstanceId,
  RunId,
  type OrchestrationV2ServerCommand,
  type ServerProvider,
  ThreadId,
  type OrchestrationV2DomainEvent,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import type { ProviderInstance } from "@t3tools/provider-core/server/driver";

import * as ProviderInstanceRegistry from "../provider/ProviderInstanceRegistry.ts";
import * as Scheduler from "../scheduling/Scheduler.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as Orchestrator from "./Orchestrator.ts";
import * as ProjectionStore from "./ProjectionStore.ts";
import * as ThreadManagement from "./ThreadManagementService.ts";
import * as UsageLimitRecoveryWorker from "./UsageLimitRecoveryWorker.ts";
import { limitRecoveryCommand } from "./UsageLimitRecoveryWorker.ts";

it.effect("idle sweeps skip SQL until the next wake time or a relevant event", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(Date.parse("2026-07-01T09:00:00.000Z"));
    const startMs = Date.parse("2026-07-01T09:00:00.000Z");
    const queries = yield* Queue.unbounded<number>();
    const events = yield* Queue.unbounded<OrchestrationV2DomainEvent>();
    const layer = UsageLimitRecoveryWorker.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Scheduler.layer,
          Layer.mock(ProjectionStore.ProjectionStoreV2)({
            getLimitRecoveryCandidates: () =>
              Clock.currentTimeMillis.pipe(
                Effect.flatMap((nowMs) => Queue.offer(queries, nowMs - startMs)),
                Effect.as([]),
              ),
            // One armed thread resets at 60s.
            getLimitRecoveryWakeAt: (now) =>
              Effect.succeed(
                DateTime.toEpochMillis(now) < startMs + 60_000 ? startMs + 60_000 : null,
              ),
          }),
          Layer.mock(ThreadManagement.ThreadManagementService)({}),
          Layer.mock(Orchestrator.OrchestratorV2)({
            streamDomainEvents: Stream.fromQueue(events),
          }),
          Layer.mock(ServerSettings.ServerSettingsService)({
            getSettings: Effect.succeed({
              autoResumeLimitedThreads: true,
              snoozeLimitedThreads: false,
            } as never),
            streamChanges: Stream.never,
          }),
          Layer.mock(ProviderInstanceRegistry.ProviderInstanceRegistry)({
            listInstances: Effect.succeed([]),
          }),
        ),
      ),
    );
    yield* Effect.gen(function* () {
      assert.equal(yield* Queue.take(queries), 0);
      // Eleven idle ticks before the recorded wake time, then the wake tick itself.
      yield* TestClock.adjust("60 seconds");
      assert.equal(yield* Queue.take(queries), 60_000);
      yield* Queue.offer(events, {
        type: "turn-item.updated",
        payload: { type: "assistant_message" },
      } as never);
      yield* TestClock.adjust("30 seconds");
      yield* Queue.offer(events, { type: "run.updated", payload: { status: "failed" } } as never);
      yield* TestClock.adjust("5 seconds");
      // A streaming item at 90s does not wake it; the failed run does on the 95s tick.
      assert.equal(yield* Queue.take(queries), 95_000);
    }).pipe(Effect.provide(layer));
  }),
);

const HOUR_MS = 60 * 60 * 1000;
const nowMs = Date.parse("2026-10-19T12:00:00.000Z");

const failedThread = (failedAgoMs: number, resetAgoMs: number) => {
  const failedAt = DateTime.makeUnsafe(nowMs - failedAgoMs);
  const candidate: ProjectionStore.ProjectionLimitRecoveryTarget = {
    id: ThreadId.make("thread:limited"),
    status: "failed",
    lastErrorClass: "usage_limit",
    usageLimitResetAt: DateTime.formatIso(DateTime.makeUnsafe(nowMs - resetAgoMs)),
    latestRunId: RunId.make("run:limited"),
    latestRunCompletedAt: failedAt,
    updatedAt: failedAt,
    archivedAt: null,
    settledOverride: null,
    pendingRuntimeRequest: null,
    limitRecovery: null,
    snoozedUntil: null,
    providerInstanceId: ProviderInstanceId.make("antigravity_01"),
    modelSelection: {
      instanceId: ProviderInstanceId.make("antigravity_01"),
      model: "gemini-3-flash",
    },
    usageLimitContinuationOfRunId: null,
  };
  return candidate;
};

describe("limitRecoveryCommand arming", () => {
  it("does not freshly arm a failure whose reset passed days ago", () => {
    const thread = failedThread(5 * 24 * HOUR_MS, 4 * 24 * HOUR_MS);
    assert.isNull(limitRecoveryCommand(thread, true, nowMs));
    assert.isNull(limitRecoveryCommand(thread, true, nowMs, true));
  });

  it("still arms a failure whose reset only just passed", () => {
    const thread = failedThread(6 * HOUR_MS, HOUR_MS);
    const arm = limitRecoveryCommand(thread, true, nowMs);
    assert.equal(arm?.type, "thread.metadata.update");
  });

  it("arms a reset that is exactly 24 hours overdue", () => {
    const thread = failedThread(30 * HOUR_MS, 24 * HOUR_MS);
    const arm = limitRecoveryCommand(thread, true, nowMs);
    assert.equal(arm?.type, "thread.metadata.update");
  });

  it("does not arm a reset that is 24 hours and 1ms overdue", () => {
    const thread = failedThread(30 * HOUR_MS, 24 * HOUR_MS + 1);
    assert.isNull(limitRecoveryCommand(thread, true, nowMs));
  });
});

const ANTIGRAVITY = ProviderDriverKind.make("antigravity");

const providerSnapshot = (instanceId: string, usedPercent: number): ServerProvider => ({
  instanceId: ProviderInstanceId.make(instanceId),
  driver: ANTIGRAVITY,
  enabled: true,
  installed: true,
  version: "1.5.1",
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: DateTime.formatIso(DateTime.makeUnsafe(nowMs)),
  models: [{ slug: "gemini-3-flash", name: "Gemini 3 Flash", isCustom: false, capabilities: null }],
  slashCommands: [],
  skills: [],
  usageLimits: {
    checkedAt: DateTime.formatIso(DateTime.makeUnsafe(nowMs)),
    windows: [
      {
        id: "weekly",
        kind: "weekly",
        label: "Weekly",
        usedPercent,
        resetsAt: DateTime.formatIso(DateTime.makeUnsafe(nowMs + HOUR_MS)),
      },
    ],
  },
});

const providerInstance = (instanceId: string, usedPercent: number): ProviderInstance =>
  ({
    instanceId: ProviderInstanceId.make(instanceId),
    driverKind: ANTIGRAVITY,
    continuationIdentity: {
      driverKind: ANTIGRAVITY,
      continuationKey: `antigravity:instance:${instanceId}`,
    },
    displayName: undefined,
    enabled: true,
    snapshot: { getSnapshot: Effect.succeed(providerSnapshot(instanceId, usedPercent)) },
  }) as unknown as ProviderInstance;

const armedThread = (thread: ProjectionStore.ProjectionLimitRecoveryTarget) => ({
  ...thread,
  limitRecovery: {
    runId: thread.latestRunId!,
    resetAt: thread.usageLimitResetAt!,
    autoResume: true,
    requestId: CommandId.make("cmd:limit"),
  },
});

const recoveryLayer = (input: {
  readonly candidates: Ref.Ref<ReadonlyArray<ProjectionStore.ProjectionLimitRecoveryTarget>>;
  readonly commands: Queue.Queue<OrchestrationV2ServerCommand>;
  readonly instances: ReadonlyArray<ProviderInstance>;
}) =>
  UsageLimitRecoveryWorker.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Scheduler.layer,
        Layer.mock(ProjectionStore.ProjectionStoreV2)({
          getLimitRecoveryCandidates: () => Ref.get(input.candidates),
          getLimitRecoveryWakeAt: () => Effect.succeed(null),
        }),
        Layer.mock(ThreadManagement.ThreadManagementService)({
          dispatch: (command) => Queue.offer(input.commands, command).pipe(Effect.as({} as never)),
        }),
        Layer.mock(Orchestrator.OrchestratorV2)({ streamDomainEvents: Stream.never }),
        Layer.mock(ServerSettings.ServerSettingsService)({
          getSettings: Effect.succeed({
            autoResumeLimitedThreads: true,
            snoozeLimitedThreads: false,
          } as never),
          streamChanges: Stream.never,
        }),
        Layer.mock(ProviderInstanceRegistry.ProviderInstanceRegistry)({
          listInstances: Effect.succeed(input.instances),
        }),
      ),
    ),
  );

describe("quota recovery rotation", () => {
  it.effect("resumes on another account when the current one has no quota", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(nowMs);
      const commands = yield* Queue.unbounded<OrchestrationV2ServerCommand>();
      const candidates = yield* Ref.make<
        ReadonlyArray<ProjectionStore.ProjectionLimitRecoveryTarget>
      >([armedThread(failedThread(6 * HOUR_MS, HOUR_MS))]);
      const layer = recoveryLayer({
        candidates,
        commands,
        instances: [providerInstance("antigravity_01", 100), providerInstance("antigravity_02", 5)],
      });
      yield* Effect.gen(function* () {
        yield* TestClock.adjust("5 seconds");
        const command = yield* Queue.take(commands);
        assert.equal(command.type, "message.dispatch");
        if (command.type !== "message.dispatch") return;
        assert.equal(command.modelSelection?.instanceId, "antigravity_02");
        assert.equal(command.usageLimitRecoveryRequestId, "cmd:limit");
      }).pipe(Effect.provide(layer));
    }),
  );

  it.effect("stops instead of looping when every account is exhausted", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(nowMs);
      const commands = yield* Queue.unbounded<OrchestrationV2ServerCommand>();
      const candidates = yield* Ref.make<
        ReadonlyArray<ProjectionStore.ProjectionLimitRecoveryTarget>
      >([armedThread(failedThread(6 * HOUR_MS, HOUR_MS))]);
      const layer = recoveryLayer({
        candidates,
        commands,
        instances: [
          providerInstance("antigravity_01", 100),
          providerInstance("antigravity_02", 100),
        ],
      });
      yield* Effect.gen(function* () {
        yield* TestClock.adjust("5 seconds");
        const sent = [...(yield* Queue.takeAll(commands))];
        assert.isAtLeast(sent.length, 1);
        assert.isTrue(
          sent.every(
            (command) =>
              command.type === "thread.metadata.update" &&
              command.limitRecovery?.autoResume === false,
          ),
        );
        // The disarm lands as a projection update, so the same failure is not re-disarmed.
        yield* Ref.set(candidates, [
          {
            ...armedThread(failedThread(6 * HOUR_MS, HOUR_MS)),
            limitRecovery: {
              runId: RunId.make("run:limited"),
              resetAt: DateTime.formatIso(DateTime.makeUnsafe(nowMs - HOUR_MS)),
              autoResume: false,
              requestId: CommandId.make("cmd:limit"),
            },
          },
        ]);
        yield* TestClock.adjust("5 seconds");
        assert.equal(yield* Queue.size(commands), 0);
      }).pipe(Effect.provide(layer));
    }),
  );
});
