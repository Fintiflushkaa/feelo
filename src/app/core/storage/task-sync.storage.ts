import type { FeeloDb } from './db';
import type { OutboxRecord, OutboxState, TaskRecord } from './storage.models';

type SessionGuard = () => void;

export class TaskSyncStore {
  constructor(private readonly db: FeeloDb) {}

  async maximumSequence(): Promise<number> {
    return (await this.db.outbox.orderBy('sequence').last())?.sequence ?? 0;
  }

  async refreshIds(): Promise<string[]> {
    return this.db.tasks.filter((task) => task.needsRefresh === true).primaryKeys();
  }

  async next(maximumSequence: number, now: number): Promise<OutboxRecord | undefined> {
    const seen = new Set<string>();
    for (const operation of await this.db.outbox.orderBy('sequence').toArray()) {
      if (operation.sequence === undefined || operation.sequence > maximumSequence) break;
      if (seen.has(operation.entityId)) continue;
      seen.add(operation.entityId);
      // Первая заблокированная команда блокирует только последующие команды ЭТОЙ задачи.
      if (operation.state === 'pending' && operation.nextAttemptAt <= now) return operation;
    }
    return undefined;
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
      const related = await this.operations(operation.entityId);
      if (related[0]?.sequence !== sequence) return undefined;
      const task = await this.db.tasks.get(operation.entityId);
      if (!task) throw new Error('В очереди есть команда для отсутствующей локальной задачи');
      if (operation.action === 'update' && operation.requestVersion === undefined) {
        if (task.version === null)
          throw new Error('Для update неизвестна подтверждённая серверная version');
        operation = { ...operation, requestVersion: task.version };
      }
      operation = { ...operation, attempts: operation.attempts + 1 };
      guard();
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
        const remaining = await this.operations(task.id);
        if (operation.action === 'delete' && remaining.length === 0) {
          await this.db.tasks.delete(task.id);
        } else {
          if (operation.action !== 'delete') {
            task.version = version;
            task.needsRefresh = true;
          }
          task.syncState = this.stateFor(remaining, task.needsRefresh === true);
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
  ): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      guard();
      const operation = await this.db.outbox.get(sequence);
      if (!operation) return;
      operation.state = state;
      operation.lastError = message;
      operation.nextAttemptAt = nextAttemptAt;
      if (conflictedTask) operation.conflictedTask = conflictedTask;
      await this.db.outbox.put(operation);
      const task = await this.db.tasks.get(operation.entityId);
      if (task) {
        task.syncState = this.stateFor(await this.operations(task.id), task.needsRefresh === true);
        await this.db.tasks.put(task);
      }
      guard();
    });
  }

  /** Явный повтор отказа, не разрешение конфликта. Замороженная requestVersion сохраняется. */
  async retryFailed(taskId: string, guard: SessionGuard): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      guard();
      await this.db.outbox
        .where('[entityType+entityId]')
        .equals(['task', taskId])
        .filter((operation) => operation.state === 'failed')
        .modify((operation) => {
          operation.state = 'pending';
          operation.nextAttemptAt = 0;
          operation.lastError = null;
          delete operation.conflictedTask;
        });
      const task = await this.db.tasks.get(taskId);
      if (task) {
        task.syncState = this.stateFor(await this.operations(taskId), task.needsRefresh === true);
        await this.db.tasks.put(task);
      }
      guard();
    });
  }

  /** Явный повтор только failed-create/update с точно совпадающей сохранённой ошибкой. */
  async retryFailedResults(errorMessage: string, guard: SessionGuard): Promise<number> {
    return this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      guard();
      const operations = await this.db.outbox
        .where('state')
        .equals('failed')
        .filter(
          (operation) => operation.action !== 'delete' && operation.lastError === errorMessage,
        )
        .toArray();
      const taskIds = new Set<string>();
      for (const operation of operations) {
        operation.state = 'pending';
        operation.nextAttemptAt = 0;
        operation.lastError = null;
        delete operation.conflictedTask;
        await this.db.outbox.put(operation);
        taskIds.add(operation.entityId);
      }
      for (const taskId of taskIds) {
        const task = await this.db.tasks.get(taskId);
        if (task) {
          task.syncState = this.stateFor(await this.operations(taskId), task.needsRefresh === true);
          await this.db.tasks.put(task);
        }
      }
      // payload, requestVersion, sequence, attempts, revisions и tombstone не меняются.
      guard();
      return operations.length;
    });
  }

  /** Явная коррекция невалидного локального создания, не универсальное переписывание истории. */
  async fixCreateDate(taskId: string, date: string, guard: SessionGuard): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      guard();
      const task = await this.db.tasks.get(taskId);
      const operations = await this.operations(taskId);
      const create = operations[0];
      if (
        !task ||
        task.version !== null ||
        task.ownerId !== null ||
        task.needsRefresh ||
        create?.action !== 'create' ||
        create.state !== 'failed' ||
        create.payload.date
      ) {
        throw new Error(
          'Можно исправить только failed-create без date и без серверного подтверждения',
        );
      }
      // Пустая date не проходит taskCreateToDto: POST с этим снимком не выполнялся.
      create.payload = { ...create.payload, date };
      create.state = 'pending';
      create.nextAttemptAt = 0;
      create.lastError = null;
      task.date = date;
      for (const operation of operations) {
        if (operation.action === 'update' && operation.payload.date !== undefined)
          task.date = operation.payload.date;
      }
      task.to = null;
      task.localUpdatedAt = Date.now();
      task.syncState = this.stateFor(operations, false);
      // Не создаём новую команду, не меняем ID/sequence/revision или остальные payload.
      await this.db.outbox.put(create);
      await this.db.tasks.put(task);
      guard();
    });
  }

  /** Канонический ответ + повторное наложение ещё НЕ подтверждённых локальных patch. */
  async applyServerSnapshot(records: readonly TaskRecord[], guard: SessionGuard): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      guard();
      for (const remote of records) {
        if (remote.ownerId?.toLowerCase() !== this.db.userId.toLowerCase()) {
          throw new Error('Ответ содержит задачу другого пользователя');
        }
        if (remote.version === null) throw new Error('GET не содержит серверную version');
        const current = await this.db.tasks.get(remote.id);
        if (
          current &&
          !current.needsRefresh &&
          (current.syncState !== 'synced' || current.deletedAt !== null)
        )
          continue;
        // Не принимаем заведомо более старый GET после подтверждённой записи.
        if (
          current?.version !== null &&
          current?.version !== undefined &&
          remote.version < current.version
        )
          continue;
        const operations = current?.needsRefresh ? await this.operations(remote.id) : [];
        if (operations.some((operation) => operation.action === 'create')) {
          throw new Error('Нельзя заменить локальное создание серверным снимком');
        }
        let merged: TaskRecord = {
          ...remote,
          localRevision: current?.localRevision ?? 0,
          localUpdatedAt: current?.localUpdatedAt ?? 0,
          deletedAt: current?.deletedAt ?? null,
        };
        for (const operation of operations) {
          if (operation.action === 'update') merged = { ...merged, ...operation.payload };
        }
        if (operations.length > 0 && current?.version !== null && current?.version !== undefined) {
          // Внешняя запись между ACK и GET не должна незаметно перебазировать следующий update.
          merged.version = current.version;
        }
        if (merged.from !== remote.from || merged.duration !== remote.duration) merged.to = null;
        merged.syncState = this.stateFor(operations, false);
        delete merged.needsRefresh;
        await this.db.tasks.put(merged);
        guard();
      }
      guard();
    });
  }

  async summary(
    now: number,
  ): Promise<{ remaining: number; nextRetryAt: number | null; error: string | null }> {
    const operations = await this.db.outbox.orderBy('sequence').toArray();
    const heads = new Map<string, OutboxRecord>();
    for (const operation of operations)
      if (!heads.has(operation.entityId)) heads.set(operation.entityId, operation);
    const times = [...heads.values()]
      .filter((operation) => operation.state === 'pending')
      .map((operation) => Math.max(now, operation.nextAttemptAt));
    return {
      remaining: operations.length,
      nextRetryAt: times.length ? Math.min(...times) : null,
      error: operations.find((operation) => operation.lastError)?.lastError ?? null,
    };
  }

  private operations(taskId: string): Promise<OutboxRecord[]> {
    return this.db.outbox
      .where('[entityType+entityId]')
      .equals(['task', taskId])
      .sortBy('sequence');
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
