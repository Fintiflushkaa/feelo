import { inject, Injectable } from '@angular/core';
import {
  filter,
  firstValueFrom,
  take,
  takeUntil,
  timeout,
  TimeoutError,
  type Observable,
} from 'rxjs';
import type { TaskDtoTaskSyncResult } from '@api/models/task-dto-task-sync-result';
import type { TaskSyncStatus } from '@api/models/task-sync-status';
import { TasksService } from '@api/services/tasks.service';
import { DatabaseSessionService } from '@core/storage/database-session.service';
import type { FeeloDb } from '@core/storage/db';
import type { OutboxRecord, TaskRecord } from '@core/storage/storage.models';
import { TaskSyncStore } from '@core/storage/task-sync.storage';
import {
  isTaskDate,
  isTaskVersion,
  taskCreateToDto,
  taskDtoToRecord,
  taskPatchToDto,
  taskSyncResultFor,
  type TaskSyncResponse,
} from './task.mapper';

export interface TaskSyncReport {
  state:
    | 'completed'
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
  nextRetryAt: number | null;
  error: string | null;
}

class SessionChanged extends Error {}
class RefreshFailed extends Error {}

/** Ручной push + каноническое чтение. Не вызывает enqueue-методы репозитория. */
@Injectable({ providedIn: 'root' })
export class TaskSyncService {
  private readonly api = inject(TasksService);
  private readonly dbSession = inject(DatabaseSessionService);
  private readonly running = new WeakMap<FeeloDb, Promise<TaskSyncReport>>();

  sync(): Promise<TaskSyncReport> {
    const db = this.dbSession.requireDb();
    const existing = this.running.get(db);
    if (existing) return existing;
    const request = this.withLock(db).finally(() => this.running.delete(db));
    this.running.set(db, request);
    return request;
  }

  /** После явного решения пользователя; Conflicted этот метод не разблокирует. */
  async retryFailed(taskId: string): Promise<void> {
    const db = this.dbSession.requireDb();
    await new TaskSyncStore(db).retryFailed(taskId, () => this.assertCurrent(db));
  }

  /**
   * Явный повтор create/update, застрявших из-за старого чтения response.status у UUID-словаря.
   * HTTP здесь нет. Не сбрасывает NotPlanned, конфликты или failed-delete.
   */
  async retryResponseFailures(): Promise<number> {
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
    try {
      return await new TaskSyncStore(db).retryFailedResults(
        'Неизвестный TaskSyncStatus: undefined',
        () => {
          if (invalidated) throw new SessionChanged('Сессия уже менялась во время повтора');
          this.assertCurrent(db);
        },
      );
    } finally {
      changed.unsubscribe();
    }
  }

  /** Исправление явно выбранной датой только failed-create без date, не отправленного этим mapper. */
  async fixCreateDate(taskId: string, date: string): Promise<void> {
    if (!isTaskDate(date)) throw new Error('Укажите дату задачи в формате YYYY-MM-DD');
    const db = this.dbSession.requireDb();
    await new TaskSyncStore(db).fixCreateDate(taskId, date, () => this.assertCurrent(db));
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
    // Без Web Locks гарантируется single-flight в этом экземпляре сервиса, не между вкладками.
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
      if (invalidated) throw new SessionChanged('Сессия уже менялась во время синхронизации');
      this.assertCurrent(db);
    };
    let pulledAfterLastWrite = false;
    try {
      guard();
      // Новые команды, появившиеся во время запуска, остаются для следующего sync().
      const maximumSequence = await store.maximumSequence();
      if ((await store.refreshIds()).length) {
        await this.pull(db, store, guard);
        pulledAfterLastWrite = true;
      }
      while (true) {
        guard();
        const candidate = await store.next(maximumSequence, Date.now());
        guard();
        if (!candidate) break;
        const sequence = candidate.sequence;
        if (sequence === undefined) throw new Error('У сохранённой команды отсутствует sequence');
        let operation: OutboxRecord | undefined;
        let source: Observable<TaskSyncResponse | void>;
        try {
          operation = await store.prepare(sequence, Date.now(), guard);
          guard();
          if (!operation) continue;
          source = this.operationRequest(db, operation);
        } catch (error) {
          guard();
          await store.mark(sequence, 'failed', this.message(error), 0, guard);
          report.failed += 1;
          continue;
        }
        let response: TaskSyncResponse | void;
        try {
          report.sent += 1;
          response = await this.request(db, source);
          guard();
        } catch (error) {
          guard();
          const status = this.httpStatus(error);
          const message = this.message(error);
          const unauthorized = status === 401 || status === 403;
          const transient =
            status === 0 ||
            (status !== null && status >= 500) ||
            status === 408 ||
            status === 425 ||
            status === 429 ||
            error instanceof TimeoutError;
          const state =
            unauthorized || transient ? 'pending' : status === 409 ? 'conflicted' : 'failed';
          const delay = transient
            ? Math.min(60_000, 1_000 * 2 ** Math.min(operation.attempts - 1, 6))
            : 0;
          await store.mark(sequence, state, message, delay ? Date.now() + delay : 0, guard);
          if (unauthorized || transient) {
            report.state = unauthorized ? 'unauthorized' : 'retry-later';
            report.error = message;
            break;
          }
          if (state === 'conflicted') report.conflicted += 1;
          else report.failed += 1;
          continue;
        }
        if (operation.action === 'delete') {
          // delete(): Observable<void>; только успешный HTTP подтверждает удаление.
          await store.acknowledge(sequence, null, guard);
          report.accepted += 1;
          pulledAfterLastWrite = false;
          continue;
        }
        if (!response) {
          await store.mark(
            sequence,
            'failed',
            'Сервер не вернул результат синхронизации',
            0,
            guard,
          );
          report.failed += 1;
          continue;
        }
        let result: TaskDtoTaskSyncResult;
        let verdict: 'accepted' | 'failed' | 'conflicted';
        try {
          result = taskSyncResultFor(operation.entityId, response);
          verdict = this.verdict(operation.action, result.status);
        } catch (error) {
          await store.mark(sequence, 'failed', this.message(error), 0, guard);
          report.failed += 1;
          continue;
        }
        if (verdict !== 'accepted') {
          let remote: TaskRecord | undefined;
          let message = result.errorMessage ?? `Сервер вернул ${result.status}`;
          const dto = result.conflictedTask;
          if (verdict === 'conflicted' && dto) {
            if (
              dto.id === operation.entityId &&
              typeof dto.ownerId === 'string' &&
              dto.ownerId.toLowerCase() === db.userId.toLowerCase() &&
              isTaskVersion(dto.version)
            ) {
              remote = taskDtoToRecord(dto);
            } else {
              message += '; конфликтный снимок имеет неверный ID, владельца или version';
            }
          }
          await store.mark(sequence, verdict, message, 0, guard, remote);
          if (verdict === 'conflicted') report.conflicted += 1;
          else report.failed += 1;
          continue;
        }
        const version = isTaskVersion(result.version) ? result.version : null;
        // ACK сначала фиксируется отдельно. Провал последующего GET не вернёт эту команду в очередь.
        await store.acknowledge(sequence, version, guard);
        report.accepted += 1;
        await this.pull(db, store, guard);
        pulledAfterLastWrite = true;
      }
      if (report.state === 'completed' && !pulledAfterLastWrite) await this.pull(db, store, guard);
    } catch (error) {
      if (
        invalidated ||
        error instanceof SessionChanged ||
        !this.dbSession.isCurrent(db) ||
        !db.isOpen()
      ) {
        report.state = 'cancelled';
      } else {
        report.state = error instanceof RefreshFailed ? 'refresh-failed' : 'storage-error';
        report.error = this.message(error);
      }
    }
    if (!invalidated && this.dbSession.isCurrent(db) && db.isOpen()) {
      try {
        const summary = await store.summary(Date.now());
        report.remaining = summary.remaining;
        report.nextRetryAt = summary.nextRetryAt;
        report.error ??= summary.error;
      } catch (error) {
        report.state = 'storage-error';
        report.error = this.message(error);
      }
    }
    changed.unsubscribe();
    if (invalidated || !this.dbSession.isCurrent(db) || !db.isOpen()) report.state = 'cancelled';
    return report;
  }

  private operationRequest(
    db: FeeloDb,
    operation: OutboxRecord,
  ): Observable<TaskSyncResponse | void> {
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

  private async pull(db: FeeloDb, store: TaskSyncStore, guard: () => void): Promise<void> {
    try {
      const dtos = await this.request(db, this.api.get());
      guard();
      if (dtos.some((dto) => !isTaskVersion(dto.version)))
        throw new Error('GET содержит некорректную int32 version');
      await store.applyServerSnapshot(dtos.map(taskDtoToRecord), guard);
      guard();
      const missing = await store.refreshIds();
      if (missing.length)
        throw new Error(
          `ACK сохранён, но свежий GET пока не подтвердил задачи: ${missing.join(', ')}`,
        );
    } catch (error) {
      guard();
      throw new RefreshFailed(this.message(error));
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

  private verdict(
    action: 'create' | 'update',
    status: TaskSyncStatus,
  ): 'accepted' | 'failed' | 'conflicted' {
    switch (status) {
      case 'Created':
        return action === 'create' ? 'accepted' : 'failed';
      case 'Modified':
        return action === 'update' ? 'accepted' : 'failed';
      case 'Synced':
        return 'accepted';
      case 'Conflicted':
        return 'conflicted';
      case 'NotPlanned':
      case 'Deleted':
        return 'failed';
      default:
        throw new Error(`Неизвестный TaskSyncStatus: ${status satisfies never}`);
    }
  }

  private assertCurrent(db: FeeloDb): void {
    if (!this.dbSession.isCurrent(db) || !db.isOpen())
      throw new SessionChanged('Сессия пользовательской БД изменилась');
  }

  private httpStatus(error: unknown): number | null {
    return typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof error.status === 'number'
      ? error.status
      : null;
  }

  private message(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
    )
      return error.message;
    return String(error);
  }

  private report(): TaskSyncReport {
    return {
      state: 'completed',
      sent: 0,
      accepted: 0,
      failed: 0,
      conflicted: 0,
      remaining: 0,
      nextRetryAt: null,
      error: null,
    };
  }
}
