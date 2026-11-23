import { liveQuery } from 'dexie';

import type { TaskData, UpdateTaskInput } from '../data/tasks/task.model';

import type { FeeloDb } from './db';
import type { TaskOperation, TaskRecord } from './storage.models';

export class TaskStore {
  constructor(private readonly db: FeeloDb) {}

  observeActive() {
    return liveQuery(() => this.db.tasks.filter((task) => task.deletedAt === null).toArray());
  }

  async upsertSynced(records: readonly TaskRecord[]): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, async () => {
      for (const record of records) {
        if (record.ownerId?.toLowerCase() !== this.db.userId.toLowerCase()) {
          throw new Error('Нельзя сохранить задачи другого пользователя в эту БД');
        }

        const current = await this.db.tasks.get(record.id);

        if (current && (current.syncState !== 'synced' || current.deletedAt !== null)) {
          continue;
        }

        await this.db.tasks.put({
          ...record,
          syncState: 'synced',
          localRevision: current?.localRevision ?? 0,
          localUpdatedAt: current?.localUpdatedAt ?? 0,
          deletedAt: null,
        });
      }
    });
  }

  create(data: TaskData): Promise<TaskRecord> {
    return this.write(data.id, {
      action: 'create',
      payload: data,
    });
  }

  update(id: string, changes: UpdateTaskInput): Promise<TaskRecord> {
    return this.write(id, {
      action: 'update',
      payload: changes,
    });
  }

  async remove(id: string): Promise<void> {
    await this.write(id, {
      action: 'delete',
      payload: null,
    });
  }

  private write(id: string, operation: TaskOperation<TaskData>): Promise<TaskRecord> {
    const command = structuredClone(operation);

    return this.db.transaction('rw', this.db.tasks, this.db.outbox, async () => {
      const current = command.action === 'create' ? undefined : await this.db.tasks.get(id);
      const now = Date.now();
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
          to: next.from !== current.from || next.duration !== current.duration ? null : current.to,
          syncState:
            current.syncState === 'failed' || current.syncState === 'conflicted'
              ? current.syncState
              : 'pending',
          localRevision: current.localRevision + 1,
          localUpdatedAt: now,
        };
      }

      // Создание не должно перезаписать уже существующую задачу без объявления.
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
    });
  }
}
