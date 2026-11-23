import { inject, Injectable } from '@angular/core';
import { filter, firstValueFrom, take, takeUntil, timeout, type Observable } from 'rxjs';
import { TasksService } from '@core/api/services/tasks.service';
import { DatabaseSessionService } from '@core/storage/database-session.service';
import type { FeeloDb } from '@core/storage/db';
import type { OutboxRecord, SyncErrorCode, TaskRecord } from '@core/storage/storage.models';
import { isStorageQuotaFailure } from '@core/storage/storage.errors';
import { taskCreateToDto, taskPatchToDto, taskSnapshotFor } from './task.mapper';
import { isTaskVersion, taskSyncResultFor, SyncResponseError } from './sync-response';
import { errorMessage, failurePolicy, isHttpFailure, syncVerdict } from './sync-policy';
import { TASK_CLOCK } from './task-clock';
import { TaskSyncStore } from '@app/core/storage/task/task-sync.storage';

export interface TaskSyncReport {
  state:
    | 'completed'
    | 'awaiting-refresh'
    | 'retry-later'
    | 'unauthorized'
    | 'cancelled'
    | 'refresh-failed'
    | 'storage-error'
    | 'busy';
  sent: number;
  accepted: number;
  failed: number;
  conflicted: number;
  remaining: number;
  awaitingRefresh: number;
  rejectedRecords: number;
  nextRetryAt: number | null;
  error: string | null;
  errorCode: SyncErrorCode | null;
}

class SessionChanged extends Error {}

/** Push immutable-команд; канонический GET один на пакет, кроме зависимости от ACK без version. */
@Injectable({ providedIn: 'root' })
export class TaskSyncService {
  private readonly api = inject(TasksService);
  private readonly dbSession = inject(DatabaseSessionService);
  private readonly now = inject(TASK_CLOCK);
  private readonly running = new WeakMap<FeeloDb, Promise<TaskSyncReport>>();

  sync(): Promise<TaskSyncReport> {
    const db = this.dbSession.requireDb();
    const existing = this.running.get(db);
    if (existing) return existing;
    const request = this.withLock(db).finally(() => this.running.delete(db));
    this.running.set(db, request);
    return request;
  }

  async retryFailed(taskId: string): Promise<void> {
    await this.inSession((db, guard) => new TaskSyncStore(db).retryFailed(taskId, guard));
  }

  private async inSession<T>(work: (db: FeeloDb, guard: () => void) => Promise<T>): Promise<T> {
    const db = this.dbSession.requireDb();
    let invalidated = false;
    const changed = this.dbSession.db$
      .pipe(
        filter((current) => current !== db),
        take(1),
      )
      .subscribe(() => {
        invalidated = true;
      });
    const guard = () => {
      if (invalidated || !this.dbSession.isCurrent(db) || !db.isOpen())
        throw new SessionChanged('Сессия пользовательской БД изменилась');
    };
    try {
      guard();
      return await work(db, guard);
    } finally {
      changed.unsubscribe();
    }
  }

  private async withLock(db: FeeloDb): Promise<TaskSyncReport> {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request(
        `feelo:tasks-sync:${db.name}`,
        { ifAvailable: true },
        async (lock) => {
          if (lock) return this.run(db);
          const report = this.report();
          report.state = 'busy';
          if (this.dbSession.isCurrent(db)) report.remaining = await db.outbox.count();
          return report;
        },
      );
    }
    return this.run(db);
  }

  private async run(db: FeeloDb): Promise<TaskSyncReport> {
    const report = this.report();
    const store = new TaskSyncStore(db);
    let invalidated = false;
    const changed = this.dbSession.db$
      .pipe(
        filter((current) => current !== db),
        take(1),
      )
      .subscribe(() => {
        invalidated = true;
      });
    const guard = () => {
      if (invalidated || !this.dbSession.isCurrent(db) || !db.isOpen())
        throw new SessionChanged('Сессия пользовательской БД изменилась');
    };
    try {
      guard();
      const maximumSequence = await store.maximumSequence();
      let commands = await store.commands(maximumSequence);
      const blocked = new Set<string>();
      // Новый проход по deferred нужен ТОЛЬКО если предыдущий ACK не содержал version.
      while (true) {
        const deferred: OutboxRecord[] = [];
        const waiting = new Set<string>();
        for (const candidate of commands) {
          guard();
          if (blocked.has(candidate.entityId)) continue;
          if (waiting.has(candidate.entityId)) {
            deferred.push(candidate);
            continue;
          }
          if (candidate.state !== 'pending' || candidate.nextAttemptAt > this.now()) {
            blocked.add(candidate.entityId);
            continue;
          }
          const sequence = candidate.sequence;
          if (sequence === undefined) throw new Error('У сохранённой команды отсутствует sequence');
          let operation: OutboxRecord | undefined;
          let source: Observable<unknown>;
          try {
            operation = await store.prepare(sequence, this.now(), guard);
            guard();
            if (!operation) {
              if (
                candidate.action === 'update' &&
                !(await store.versionReady(candidate.entityId))
              ) {
                deferred.push(candidate);
                waiting.add(candidate.entityId);
              } else blocked.add(candidate.entityId);
              continue;
            }
            source = this.operationRequest(db, operation);
          } catch (error) {
            guard();
            if (isStorageQuotaFailure(error)) throw error;
            await store.mark(
              sequence,
              'failed',
              errorMessage(error),
              0,
              guard,
              undefined,
              'invalid-command',
            );
            report.failed += 1;
            blocked.add(candidate.entityId);
            continue;
          }
          let response: unknown;
          try {
            report.sent += 1;
            response = await this.request(db, source);
            guard();
          } catch (error) {
            guard();
            const policy = failurePolicy(error, operation.attempts);
            await store.mark(
              sequence,
              policy.state,
              errorMessage(error),
              policy.delay ? this.now() + policy.delay : 0,
              guard,
              undefined,
              policy.code,
            );
            blocked.add(operation.entityId);
            if (policy.stop) {
              report.state = policy.stop;
              report.error = errorMessage(error);
              report.errorCode = policy.code;
              break;
            }
            if (policy.state === 'conflicted') report.conflicted += 1;
            else report.failed += 1;
            continue;
          }
          if (operation.action === 'delete') {
            await store.acknowledge(sequence, null, guard);
            report.accepted += 1;
            continue;
          }
          try {
            const result = taskSyncResultFor(operation.entityId, response);
            const verdict = syncVerdict(operation.action, result.status);
            if (verdict === 'accepted') {
              await store.acknowledge(
                sequence,
                isTaskVersion(result.version) ? result.version : null,
                guard,
              );
              report.accepted += 1;
              continue;
            }
            let remote: TaskRecord | undefined;
            let message = result.errorMessage ?? `Сервер вернул ${result.status}`;
            if (verdict === 'conflicted' && result.conflictedTask) {
              const snapshot = taskSnapshotFor([result.conflictedTask], db.userId);
              remote = snapshot.records.find((task) => task.id === operation.entityId);
              if (!remote)
                message += '; конфликтный снимок имеет неверный ID, владельца или version';
            }
            const state = verdict === 'conflicted' ? 'conflicted' : 'failed';
            const code =
              verdict === 'not-planned'
                ? 'not-planned'
                : verdict === 'conflicted'
                  ? 'conflict'
                  : 'invalid-response';
            await store.mark(sequence, state, message, 0, guard, remote, code);
            if (state === 'conflicted') report.conflicted += 1;
            else report.failed += 1;
          } catch (error) {
            guard();
            // Ошибка ACK/storage не является невалидным JSON и не должна повторять принятую запись.
            if (!(error instanceof SyncResponseError)) throw error;
            await store.mark(sequence, 'failed', error.message, 0, guard, undefined, error.code);
            report.failed += 1;
          }
          blocked.add(operation.entityId);
        }
        if (report.state !== 'completed') break;
        try {
          const response = await this.request(db, this.api.get());
          guard();
          const snapshot = taskSnapshotFor(response, db.userId);
          report.rejectedRecords += snapshot.rejected;
          await store.applyServerSnapshot(snapshot.records, guard, snapshot.seenIds);
          guard();
        } catch (error) {
          guard();
          if (!isHttpFailure(error) && !(error instanceof SyncResponseError)) throw error;
          report.state = 'refresh-failed';
          report.error = errorMessage(error);
          break;
        }
        report.awaitingRefresh = (await store.refreshIds()).length;
        // Replica lag
        const ready = await Promise.all([...waiting].map((id) => store.versionReady(id)));
        if (!deferred.length || !ready.some(Boolean)) {
          if (report.awaitingRefresh) report.state = 'awaiting-refresh';
          break;
        }
        commands = deferred;
      }
    } catch (error) {
      if (
        invalidated ||
        error instanceof SessionChanged ||
        !this.dbSession.isCurrent(db) ||
        !db.isOpen()
      )
        report.state = 'cancelled';
      else {
        report.state = 'storage-error';
        report.error = errorMessage(error);
        if (isStorageQuotaFailure(error)) report.errorCode = 'storage-quota';
      }
    }
    if (!invalidated && this.dbSession.isCurrent(db) && db.isOpen()) {
      try {
        const summary = await store.summary(this.now());
        report.remaining = summary.remaining;
        report.nextRetryAt = summary.nextRetryAt;
        report.awaitingRefresh = (await store.refreshIds()).length;
        if (report.error === null) {
          report.error = summary.error;
          report.errorCode = summary.errorCode;
        }
      } catch (error) {
        report.state = 'storage-error';
        report.error = errorMessage(error);
      }
    }
    changed.unsubscribe();
    if (invalidated || !this.dbSession.isCurrent(db) || !db.isOpen()) report.state = 'cancelled';
    return report;
  }

  private operationRequest(db: FeeloDb, operation: OutboxRecord): Observable<unknown> {
    switch (operation.action) {
      case 'create':
        if (operation.payload.id !== operation.entityId)
          throw new Error('ID create-payload не совпадает с entityId');
        return this.api.create(taskCreateToDto(operation.payload, db.userId, operation.createdAt));
      case 'update':
        if (operation.requestVersion === undefined)
          throw new Error('Update не содержит зафиксированную requestVersion');
        return this.api.update(
          operation.entityId,
          taskPatchToDto(operation.payload, operation.requestVersion),
        );
      case 'delete':
        return this.api.delete(operation.entityId);
      default:
        throw new Error(`Неизвестная операция: ${operation satisfies never}`);
    }
  }

  private request<T>(db: FeeloDb, source: Observable<T>): Promise<T> {
    return firstValueFrom(
      source.pipe(
        takeUntil(this.dbSession.db$.pipe(filter((current) => current !== db))),
        timeout(30_000),
      ),
    );
  }

  private report(): TaskSyncReport {
    return {
      state: 'completed',
      sent: 0,
      accepted: 0,
      failed: 0,
      conflicted: 0,
      remaining: 0,
      awaitingRefresh: 0,
      rejectedRecords: 0,
      nextRetryAt: null,
      error: null,
      errorCode: null,
    };
  }
}
