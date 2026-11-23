import Dexie, { type Table } from 'dexie';
import type { OutboxRecord, TaskRecord } from './storage.models';

const dbSchema = {
  tasks: 'id, syncState',
  outbox: '++sequence, [entityType+entityId], state, [entityType+entityId+state]',
};

export function userDbName(userId: string): string {
  if (!userId || userId.trim().length === 0) {
    throw new Error('Для открытия IndexedDB нужен userId с сервера');
  }

  return `feelo-${userId}`;
}

export class FeeloDb extends Dexie {
  readonly tasks: Table<TaskRecord, string>;
  readonly outbox: Table<OutboxRecord, number>;

  constructor(readonly userId: string) {
    super(userDbName(userId), { autoOpen: false });

    this.version(1).stores(dbSchema);

    this.tasks = this.table('tasks');
    this.outbox = this.table('outbox');

    this.on('versionchange', () => {
      this.close({ disableAutoOpen: true });
    });

    this.on('blocked', () => {
      console.warn('Открытие или обновление пользовательской БД заблокировано другой вкладкой');
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
