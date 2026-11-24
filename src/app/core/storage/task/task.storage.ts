import { TaskData, UpdateTaskInput } from '@app/core/data/tasks/task.model';
import { liveQuery } from 'dexie';
import { FeeloDb } from '../db';
import { storageFailure } from '../storage.errors';
import { TaskRecord, TaskOperation } from '../storage.models';
import { TaskSyncStore } from './task-sync.storage';

/** Сервис для работы с Task в indexDB. */
export class TaskStore {
  constructor(
    private readonly db: FeeloDb,
    private readonly now: () => number = Date.now,
  ) {}

  observeActive() {
    return liveQuery(() => this.db.tasks.filter((task) => task.deletedAt === null).toArray());
  }

  async upsertSynced(
    records: readonly TaskRecord[],
    guard: () => void = () => {},
    seenIds?: readonly string[],
  ): Promise<void> {
    await new TaskSyncStore(this.db).applyServerSnapshot(records, guard, seenIds);
  }

  create(data: TaskData): Promise<TaskRecord> {
    return this.write(data.id, { action: 'create', payload: data });
  }

  update(id: string, changes: UpdateTaskInput): Promise<TaskRecord> {
    return this.write(id, { action: 'update', payload: changes });
  }

  async remove(id: string): Promise<void> {
    await this.write(id, { action: 'delete', payload: null });
  }

  private write(id: string, operation: TaskOperation<TaskData>): Promise<TaskRecord> {
    const command = structuredClone(operation);

    return this.db
      .transaction('rw', this.db.tasks, this.db.outbox, async () => {
        const current = command.action === 'create' ? undefined : await this.db.tasks.get(id);
        const now = this.now();
        let record: TaskRecord;

        if (command.action === 'create') {
          record = {
            ...command.payload,
            to: null,
            isCompleted: false,
            completedAt: null,
            ownerId: null,
            created: null,
            updated: null,
            version: null,
            syncState: 'pending',
            localRevision: 1,
            localUpdatedAt: now,
            deletedAt: null,
          };
        } else {
          if (command.action !== 'update' && command.action !== 'delete') {
            // Новая action требует явной реализации, иначе здесь будет ошибка типов.
            throw new Error(`Неизвестная операция над задачей: ${command satisfies never}`);
          }

          if (!current) {
            throw new Error(`Задача ${id} не найдена`);
          }

          if (current.deletedAt !== null) {
            if (command.action === 'delete') return current;
            throw new Error('Нельзя изменять удалённую задачу');
          }

          if (command.action === 'update') {
            const patch = command.payload;
            const keys = Object.keys(patch) as Array<keyof UpdateTaskInput>;
            if (!keys.some((key) => patch[key] !== current[key])) return current;
          }

          const next =
            command.action === 'update'
              ? { ...current, ...command.payload }
              : { ...current, deletedAt: now };

          record = {
            ...next,
            to:
              next.from !== current.from || next.duration !== current.duration ? null : current.to,
            syncState:
              current.syncState === 'failed' || current.syncState === 'conflicted'
                ? current.syncState
                : 'pending',
            localRevision: current.localRevision + 1,
            localUpdatedAt: now,
          };
        }

        if (
          command.action !== 'create' &&
          current &&
          current.version === null &&
          current.ownerId === null &&
          !current.needsRefresh
        ) {
          const operations = await this.db.outbox
            .where('[entityType+entityId]')
            .equals(['task', id])
            .sortBy('sequence');
          const create = operations[0];
          const neverAttempted =
            current.syncState === 'pending' &&
            create?.action === 'create' &&
            operations.every(
              (operation) =>
                operation.attempts === 0 &&
                operation.state === 'pending' &&
                (operation.action !== 'update' || operation.requestVersion === undefined),
            );
          if (neverAttempted && command.action === 'delete') {
            // Одна транзакция с prepare(): attempts=0 доказывает, что отправитель ещё не захватил команду.
            const sequences = operations.map((operation) => {
              if (operation.sequence === undefined)
                throw new Error('У команды отсутствует sequence');
              return operation.sequence;
            });
            await this.db.outbox.bulkDelete(sequences);
            await this.db.tasks.delete(id);
            return record;
          }
          if (
            neverAttempted &&
            operations.length === 1 &&
            command.action === 'update' &&
            typeof create.payload.date === 'string' &&
            create.payload.date.length === 10 &&
            Object.keys(command.payload).every((key) => Object.hasOwn(create.payload, key))
          ) {
            // Completion не входит в create-контракт: такие patch остаются отдельными update.
            create.payload = { ...create.payload, ...command.payload };
            create.localRevision = record.localRevision;
            await this.db.tasks.put(record);
            await this.db.outbox.put(create);
            return record;
          }
        }

        // Создание не должно молча перезаписать уже существующую задачу.
        if (command.action === 'create') await this.db.tasks.add(record);
        else await this.db.tasks.put(record);

        await this.db.outbox.add({
          ...command,
          entityType: 'task',
          entityId: record.id,
          localRevision: record.localRevision,
          state: 'pending',
          attempts: 0,
          nextAttemptAt: 0,
          lastError: null,
          createdAt: now,
        });

        return record;
      })
      .catch(storageFailure);
  }
}
