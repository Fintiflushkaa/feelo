import Dexie, { type Table } from 'dexie';
import { OutboxRecord, TaskRecord } from './storage.models';

export function userDbName(userId: string): string {
  if (!userId || userId.trim().length === 0) {
    throw new Error('Для открытия IndexedDB нужен userId с сервера');
  }
  return `feelo-${userId}`;
}

export class FeeloDb extends Dexie {
  readonly tasks: Table<TaskRecord, string>;
  readonly outbox!: Table<OutboxRecord, number>;

  constructor(readonly userId: string) {
    super(userDbName(userId), { autoOpen: false });

    this.version(1).stores({ tasks: 'id, syncState' });
    this.version(2).stores({
      outbox: '++sequence, &operationId, [entityType+entityId], state, [state+nextAttemptAt]',
    });
    this.version(3)
      .stores({
        outbox: '++sequence, [entityType+entityId], state, [state+nextAttemptAt]',
      })
      .upgrade(async (transaction) => {
        // Фиксированная миграция старых записей, не текущий mapper.
        // После неё TaskData содержит явные null вместо отсутствующих nullable-полей.
        await transaction
          .table<Partial<TaskRecord>, string>('tasks')
          .toCollection()
          .modify((task) => {
            task.description ??= null;
            task.from ??= null;
            task.deadline ??= null;
          });

        // Сохраняем sequence, порядок, состояния и payload всех накопленных команд.
        await transaction
          .table<OutboxRecord & { operationId?: string }, number>('outbox')
          .toCollection()
          .modify((operation) => {
            delete operation.operationId;
          });
      });

    this.tasks = this.table('tasks');
    this.outbox = this.table('outbox');

    this.on('versionchange', () => {
      this.close({ disableAutoOpen: true });
    });

    this.on('blocked', () => {
      console.warn(`Открытие или обновление БД ${this.name} заблокировано другой вкладкой`);
    });
  }
}

export async function openUserDb(userId: string): Promise<FeeloDb> {
  const db = new FeeloDb(userId);

  try {
    await db.open();
    return db;
  } catch (error) {
    db.close({ disableAutoOpen: true });
    throw error;
  }
}
