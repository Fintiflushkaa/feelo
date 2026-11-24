import { FeeloDb } from '../db';
import { OutboxRecord, OutboxState, TaskRecord, SyncErrorCode } from '../storage.models';

type SessionGuard = () => void;

export class TaskSyncStore {
  constructor(private readonly db: FeeloDb) {}

  async maximumSequence(): Promise<number> {
    return (await this.db.outbox.orderBy('sequence').last())?.sequence ?? 0;
  }

  commands(maximumSequence: number): Promise<OutboxRecord[]> {
    return this.db.outbox.where('sequence').belowOrEqual(maximumSequence).toArray();
  }

  refreshIds(): Promise<string[]> {
    return this.db.tasks.filter((task) => task.needsRefresh === true).primaryKeys();
  }

  async versionReady(taskId: string): Promise<boolean> {
    const task = await this.db.tasks.get(taskId);
    return !!task && task.version !== null && task.needsVersionRefresh !== true;
  }

  async prepare(
    sequence: number,
    now: number,
    guard: SessionGuard,
  ): Promise<OutboxRecord | undefined> {
    return this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      guard();
      let operation = await this.db.outbox.get(sequence);
      if (!operation || operation.state !== 'pending' || operation.nextAttemptAt > now)
        return undefined;
      if (
        (
          await this.db.outbox
            .where('[entityType+entityId]')
            .equals(['task', operation.entityId])
            .first()
        )?.sequence !== sequence
      )
        return undefined;
      const task = await this.db.tasks.get(operation.entityId);
      if (!task) throw new Error('В очереди есть команда для отсутствующей локальной задачи');
      if (operation.action === 'update' && operation.requestVersion === undefined) {
        if (task.version === null || task.needsVersionRefresh) {
          task.needsRefresh = true;
          task.needsVersionRefresh = true;
          await this.db.tasks.put(task);
          guard();
          return undefined;
        }
        operation = { ...operation, requestVersion: task.version };
      }
      operation = { ...operation, attempts: operation.attempts + 1 };
      await this.db.outbox.put(operation);
      guard();
      return operation;
    });
  }

  async acknowledge(sequence: number, version: number | null, guard: SessionGuard): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      guard();
      const operation = await this.db.outbox.get(sequence);
      if (!operation) return;
      const task = await this.db.tasks.get(operation.entityId);
      await this.db.outbox.delete(sequence);
      if (task) {
        const remaining = await this.db.outbox
          .where('[entityType+entityId]')
          .equals(['task', task.id])
          .count();
        if (operation.action === 'delete' && remaining === 0) {
          task.deleteAcknowledged = true;
          task.needsRefresh = true;
          task.syncState = 'pending';
          await this.db.tasks.put(task);
        } else {
          if (operation.action !== 'delete') {
            if (version !== null) {
              task.version = version;
              delete task.needsVersionRefresh;
            } else {
              task.needsVersionRefresh = true;
            }
            task.needsRefresh = true;
          }
          task.syncState = await this.stateForTask(task.id, task.needsRefresh === true);
          await this.db.tasks.put(task);
        }
      }
      guard();
    });
  }

  async mark(
    sequence: number,
    state: OutboxState,
    message: string,
    nextAttemptAt: number,
    guard: SessionGuard,
    conflictedTask?: TaskRecord,
    errorCode?: SyncErrorCode,
  ): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      guard();
      const operation = await this.db.outbox.get(sequence);
      if (!operation) return;
      operation.state = state;
      operation.lastError = message;
      operation.nextAttemptAt = nextAttemptAt;
      if (errorCode) operation.errorCode = errorCode;
      if (conflictedTask) operation.conflictedTask = conflictedTask;
      await this.db.outbox.put(operation);
      const task = await this.db.tasks.get(operation.entityId);
      if (task) {
        task.syncState = await this.stateForTask(task.id, task.needsRefresh === true);
        await this.db.tasks.put(task);
      }
      guard();
    });
  }

  async retryFailed(taskId: string, guard: SessionGuard): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      guard();
      const operations = await this.db.outbox
        .where('[entityType+entityId+state]')
        .equals(['task', taskId, 'failed'])
        .toArray();
      for (const operation of operations) {
        operation.state = 'pending';
        operation.nextAttemptAt = 0;
        operation.lastError = null;
        delete operation.conflictedTask;
        await this.db.outbox.put(operation);
      }
      const task = operations.length ? await this.db.tasks.get(taskId) : undefined;
      if (task) {
        task.syncState = await this.stateForTask(taskId, task.needsRefresh === true);
        await this.db.tasks.put(task);
      }
      guard();
    });
  }

  /** Единый merge */
  async applyServerSnapshot(
    records: readonly TaskRecord[],
    guard: SessionGuard,
    seenIds?: readonly string[],
  ): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      guard();
      for (const remote of records) {
        if (remote.ownerId?.toLowerCase() !== this.db.userId.toLowerCase())
          throw new Error('Ответ содержит задачу другого пользователя');
        if (remote.version === null) throw new Error('GET не содержит серверную version');
        const current = await this.db.tasks.get(remote.id);
        if (current?.deleteAcknowledged) continue;
        if (
          current &&
          !current.needsRefresh &&
          (current.syncState !== 'synced' || current.deletedAt !== null)
        )
          continue;
        if (current?.version != null && remote.version < current.version) continue;
        const operations = current?.needsRefresh ? await this.operations(remote.id) : [];
        if (operations.some((operation) => operation.action === 'create'))
          throw new Error('Нельзя заменить локальное создание серверным снимком');
        let merged: TaskRecord = {
          ...remote,
          localRevision: current?.localRevision ?? 0,
          localUpdatedAt: current?.localUpdatedAt ?? 0,
          deletedAt: current?.deletedAt ?? null,
        };
        for (const operation of operations) {
          if (operation.action === 'update') merged = { ...merged, ...operation.payload };
        }
        if (operations.length && current?.version != null && !current.needsVersionRefresh) {
          merged.version = current.version;
        }
        if (merged.from !== remote.from || merged.duration !== remote.duration) merged.to = null;
        merged.syncState = this.stateFor(operations, false);
        delete merged.needsRefresh;
        delete merged.needsVersionRefresh;
        await this.db.tasks.put(merged);
        guard();
      }
      if (seenIds) {
        const seen = new Set(seenIds);
        const deleted = await this.db.tasks
          .filter((task) => task.deleteAcknowledged === true && !seen.has(task.id))
          .toArray();
        for (const task of deleted) {
          if (
            (await this.db.outbox
              .where('[entityType+entityId]')
              .equals(['task', task.id])
              .count()) === 0
          ) {
            await this.db.tasks.delete(task.id);
          }
        }
      }
      guard();
    });
  }

  async summary(now: number): Promise<{
    remaining: number;
    nextRetryAt: number | null;
    error: string | null;
    errorCode: SyncErrorCode | null;
  }> {
    const operations = await this.db.outbox.orderBy('sequence').toArray();
    const heads = new Map<string, OutboxRecord>();
    for (const operation of operations)
      if (!heads.has(operation.entityId)) heads.set(operation.entityId, operation);
    const times = [...heads.values()]
      .filter((operation) => operation.state === 'pending')
      .map((operation) => Math.max(now, operation.nextAttemptAt));
    const error = operations.find((operation) => operation.lastError);
    return {
      remaining: operations.length,
      nextRetryAt: times.length ? Math.min(...times) : null,
      error: error?.lastError ?? null,
      errorCode: error?.errorCode ?? null,
    };
  }

  private operations(taskId: string): Promise<OutboxRecord[]> {
    return this.db.outbox
      .where('[entityType+entityId]')
      .equals(['task', taskId])
      .sortBy('sequence');
  }

  private async stateForTask(
    taskId: string,
    needsRefresh: boolean,
  ): Promise<TaskRecord['syncState']> {
    const byState = (state: OutboxState) =>
      this.db.outbox.where('[entityType+entityId+state]').equals(['task', taskId, state]).count();
    if (await byState('conflicted')) return 'conflicted';
    if (await byState('failed')) return 'failed';
    return needsRefresh || (await byState('pending')) ? 'pending' : 'synced';
  }

  private stateFor(
    operations: readonly OutboxRecord[],
    needsRefresh: boolean,
  ): TaskRecord['syncState'] {
    if (operations.some((operation) => operation.state === 'conflicted')) return 'conflicted';
    if (operations.some((operation) => operation.state === 'failed')) return 'failed';
    return operations.length || needsRefresh ? 'pending' : 'synced';
  }
}
