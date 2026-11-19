import {
  CommandId,
  MessageId,
  type ModelSelection,
  type OrchestrationV2Command,
  type ProviderInstanceId,
  type ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import type { OrchestrationV2DomainEvent } from "@t3tools/contracts";
import * as DueHint from "../scheduling/DueHint.ts";
import * as Scheduler from "../scheduling/Scheduler.ts";
import { forkParked } from "../serverActivation.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as ProjectionStore from "./ProjectionStore.ts";
import * as Orchestrator from "./Orchestrator.ts";
import * as ThreadManagement from "./ThreadManagementService.ts";
import * as ProviderInstanceRegistry from "../provider/ProviderInstanceRegistry.ts";
import type { ProviderInstance } from "@t3tools/provider-core/server/driver";
import {
  MAX_QUOTA_RECOVERY_ATTEMPTS,
  quotaExhaustedUntil,
  quotaRecoveryNotBefore,
  selectQuotaRecoverySelection,
  type QuotaRecoveryInstance,
} from "./QuotaRecovery.ts";

export const MAX_OVERDUE_ARM_MS = 24 * 60 * 60 * 1000;

interface LimitRecoveryCommandOptions {
  /** Another account of the same driver to resume the turn on. */
  readonly modelSelection?: ModelSelection;
  /** Stop auto-resuming: every usable account is out of quota. */
  readonly giveUp?: boolean;
}

export function limitRecoveryCommand(
  thread: ProjectionStore.ProjectionLimitRecoveryCandidate,
  autoResume: boolean,
  nowMs: number,
  snooze = false,
  options: LimitRecoveryCommandOptions = {},
): OrchestrationV2Command | null {
  if (
    thread.status !== "failed" ||
    thread.lastErrorClass !== "usage_limit" ||
    !thread.latestRunId ||
    !thread.usageLimitResetAt ||
    thread.archivedAt !== null ||
    thread.settledOverride === "settled" ||
    thread.pendingRuntimeRequest !== null
  )
    return null;
  const resetMs = Date.parse(thread.usageLimitResetAt);
  // An already-expired window reported with a fresh failure cannot start a retry loop.
  if (
    !Number.isFinite(resetMs) ||
    resetMs <= DateTime.toEpochMillis(thread.latestRunCompletedAt ?? thread.updatedAt)
  )
    return null;
  const identity = `${thread.id}:${thread.latestRunId}:${resetMs}`;
  const recovery = thread.limitRecovery;
  if (options.giveUp === true) {
    if (
      recovery?.runId === thread.latestRunId &&
      recovery.resetAt === thread.usageLimitResetAt &&
      recovery.autoResume === false
    )
      return null;
    return {
      type: "thread.metadata.update",
      commandId: CommandId.make(`limit-disarm:${identity}`),
      threadId: thread.id,
      limitRecovery: {
        runId: thread.latestRunId,
        resetAt: thread.usageLimitResetAt,
        autoResume: false,
        snooze: false,
      },
    };
  }
  if (recovery?.runId !== thread.latestRunId || recovery.resetAt !== thread.usageLimitResetAt) {
    if (nowMs - resetMs > MAX_OVERDUE_ARM_MS) return null;
    if (!autoResume && (!snooze || resetMs <= nowMs)) return null;
    return {
      type: "thread.metadata.update",
      commandId: CommandId.make(`limit-arm:${identity}`),
      threadId: thread.id,
      limitRecovery: {
        runId: thread.latestRunId,
        resetAt: thread.usageLimitResetAt,
        autoResume,
        snooze: snooze && resetMs > nowMs,
      },
    };
  }
  if (
    !recovery.autoResume ||
    resetMs > nowMs ||
    (thread.snoozedUntil != null && DateTime.toEpochMillis(thread.snoozedUntil) > nowMs)
  )
    return null;
  const deliveryIdentity = `${identity}:${recovery.requestId ?? "legacy"}`;
  return {
    type: "message.dispatch",
    commandId: CommandId.make(`limit-resume:${deliveryIdentity}`),
    messageId: MessageId.make(`limit-resume:${deliveryIdentity}`),
    threadId: thread.id,
    usageLimitContinuationOfRunId: thread.latestRunId,
    ...(recovery.requestId === undefined
      ? {}
      : { usageLimitRecoveryRequestId: recovery.requestId }),
    text: "Continue where you left off.",
    attachments: [],
    dispatchMode: { type: "start_immediately" },
    createdBy: "agent",
    creationSource: "server",
    ...(options.modelSelection === undefined ? {} : { modelSelection: options.modelSelection }),
  };
}

// Events that can make a thread a candidate or change its command; streaming items cannot.
const affectsLimitRecovery = (event: OrchestrationV2DomainEvent) =>
  event.type.startsWith("thread.") ||
  event.type === "run.created" ||
  event.type === "run.updated" ||
  event.type === "runtime-request.updated" ||
  event.type.startsWith("provider-session.") ||
  (event.type === "turn-item.updated" && event.payload.type === "error");

const quotaInstanceOf = (entry: ProviderInstance): Effect.Effect<QuotaRecoveryInstance> =>
  entry.snapshot.getSnapshot.pipe(
    Effect.map((snapshot) => ({
      instanceId: entry.instanceId,
      driver: entry.driverKind,
      snapshot,
    })),
  );

const makeSweep = Effect.gen(function* () {
  const projections = yield* ProjectionStore.ProjectionStoreV2;
  const threads = yield* ThreadManagement.ThreadManagementService;
  const orchestrator = yield* Orchestrator.OrchestratorV2;
  const settings = yield* ServerSettings.ServerSettingsService;
  const instanceRegistry = yield* ProviderInstanceRegistry.ProviderInstanceRegistry;
  const quotaExhausted = yield* Ref.make<ReadonlyMap<ProviderInstanceId, number>>(new Map());
  const recoveryProgress = yield* Ref.make<
    ReadonlyMap<
      ThreadId,
      { readonly runId: string; readonly attempts: number; readonly lastAt: number }
    >
  >(new Map());
  const due = DueHint.make();
  yield* forkParked(
    Stream.runForEach(orchestrator.streamDomainEvents, (event) =>
      affectsLimitRecovery(event) ? due.invalidate : Effect.void,
    ),
  );
  yield* forkParked(Stream.runForEach(settings.streamChanges, () => due.invalidate));
  const dispatchCommand = Effect.fnUntraced(function* (
    thread: ProjectionStore.ProjectionLimitRecoveryCandidate,
    command: OrchestrationV2Command,
  ) {
    if (command.type === "thread.metadata.update" && command.limitRecovery != null) {
      if (command.limitRecovery.autoResume === false) {
        yield* threads.dispatch(command);
        return;
      }
      yield* orchestrator.autoArmLimitRecovery({
        commandId: command.commandId,
        threadId: command.threadId,
        limitRecovery: command.limitRecovery,
      });
      return;
    }
    yield* threads.dispatch(command);
  });
  const dispatchCommandSafely = (
    thread: ProjectionStore.ProjectionLimitRecoveryCandidate,
    command: OrchestrationV2Command,
  ) =>
    dispatchCommand(thread, command).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("orchestration-v2.limit-recovery.dispatch-failed", {
          threadId: thread.id,
          cause,
        }),
      ),
    );
  return Effect.fn("UsageLimitRecoveryWorker.sweep")(function* () {
    const now = yield* DateTime.now;
    const nowMs = DateTime.toEpochMillis(now);
    if (yield* due.isIdle(nowMs)) return;
    const readVersion = yield* due.version;
    const preferences = yield* settings.getSettings;
    const candidates = yield* projections.getLimitRecoveryCandidates({
      now,
      autoResume: preferences.autoResumeLimitedThreads,
      snooze: preferences.snoozeLimitedThreads,
    });
    const instances: ReadonlyArray<QuotaRecoveryInstance> =
      candidates.length === 0
        ? []
        : yield* instanceRegistry.listInstances.pipe(
            Effect.flatMap((entries) => Effect.forEach(entries, quotaInstanceOf)),
            Effect.orElseSucceed(() => []),
          );
    let acted = false;
    let deferredUntil = Infinity;
    for (const thread of candidates) {
      const resetAt = thread.usageLimitResetAt!;
      const exhaustedUntil = quotaExhaustedUntil(resetAt, nowMs);
      if (exhaustedUntil !== null) {
        yield* Ref.update(quotaExhausted, (current) =>
          new Map(current).set(thread.providerInstanceId, exhaustedUntil),
        );
      }
      const selection = selectQuotaRecoverySelection({
        instances,
        current: thread.modelSelection,
        driver: instances.find((entry) => entry.instanceId === thread.providerInstanceId)?.driver,
        exhaustedUntil: yield* Ref.get(quotaExhausted),
        nowMs,
      });
      const identity = `${thread.id}:${thread.latestRunId}:${resetAt}`;
      const progress = yield* Ref.modify(recoveryProgress, (current) => {
        const previous = current.get(thread.id);
        const next =
          previous?.runId === thread.latestRunId ||
          previous?.runId === thread.usageLimitContinuationOfRunId
            ? previous
            : { runId: thread.latestRunId!, attempts: 0, lastAt: 0 };
        return [next, new Map(current).set(thread.id, next)] as const;
      });
      if (selection.kind === "exhausted" || progress.attempts >= MAX_QUOTA_RECOVERY_ATTEMPTS) {
        const command = limitRecoveryCommand(
          thread,
          preferences.autoResumeLimitedThreads,
          nowMs,
          preferences.snoozeLimitedThreads,
          { giveUp: true },
        );
        if (command === null) continue;
        acted = true;
        yield* dispatchCommandSafely(thread, command);
        continue;
      }
      const resetMs = Date.parse(resetAt);
      const notBefore = quotaRecoveryNotBefore({
        attempt: progress.attempts,
        lastAtMs: progress.lastAt,
        resetAtMs: resetMs,
        seed: identity,
      });
      const armed =
        thread.limitRecovery?.runId === thread.latestRunId &&
        thread.limitRecovery.resetAt === resetAt;
      if (armed && nowMs < notBefore) {
        deferredUntil = Math.min(deferredUntil, notBefore);
        continue;
      }
      const command = limitRecoveryCommand(
        thread,
        preferences.autoResumeLimitedThreads,
        nowMs,
        preferences.snoozeLimitedThreads,
        selection.kind === "switch" ? { modelSelection: selection.modelSelection } : {},
      );
      if (command === null) continue;
      acted = true;
      if (command.type === "message.dispatch") {
        yield* Ref.update(recoveryProgress, (current) =>
          new Map(current).set(thread.id, {
            runId: thread.latestRunId!,
            attempts: progress.attempts + 1,
            lastAt: nowMs,
          }),
        );
      }
      yield* dispatchCommandSafely(thread, command);
    }
    // A sweep that acted, or failed to, re-checks on the next tick.
    if (acted) return;
    const wakeAt = yield* projections.getLimitRecoveryWakeAt(now);
    yield* due.record(readVersion, Math.min(deferredUntil, wakeAt ?? Infinity), nowMs);
  });
});

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const sweep = yield* makeSweep;
    const scheduler = yield* Scheduler.Scheduler;
    yield* scheduler.register("usage-limit-recovery", sweep());
  }),
);
