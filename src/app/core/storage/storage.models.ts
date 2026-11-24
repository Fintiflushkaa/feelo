import type {
  CreateTaskPayload,
  SyncState,
  Task,
  TaskServerFields,
  UpdateTaskInput,
} from '../data/tasks/task.model';

export type { SyncState } from '../data/tasks/task.model';

export interface TaskRecord extends Task, TaskServerFields {
  localRevision: number;
  localUpdatedAt: number;
  deletedAt: number | null;
  needsRefresh?: true;
  needsVersionRefresh?: true;
  deleteAcknowledged?: true;
}

export type OutboxState = Exclude<SyncState, 'synced'>;

export type SyncErrorCode =
  | 'invalid-command'
  | 'invalid-response'
  | 'legacy-response-envelope'
  | 'not-planned'
  | 'conflict'
  | 'unauthorized'
  | 'http-transient'
  | 'http-rejected'
  | 'request-error'
  | 'storage-quota';

export interface OutboxMeta {
  errorCode?: SyncErrorCode;
  sequence?: number;
  entityType: 'task';
  entityId: Task['id'];
  localRevision: TaskRecord['localRevision'];
  state: OutboxState;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  conflictedTask?: TaskRecord;
  createdAt: number;
}

export type TaskOperation<TCreate extends CreateTaskPayload = CreateTaskPayload> =
  | { action: 'create'; payload: TCreate }
  | {
      action: 'update';
      payload: UpdateTaskInput;
      /**
       * Версия для HTTP-запроса, фиксируемая отправителем перед первой попыткой.
       * Отсутствует у ещё не подготовленной команды; 0 — допустимое значение.
       * При повторной доставке не заменяется более свежей версией из TaskRecord.
       */
      requestVersion?: number;
    }
  | { action: 'delete'; payload: null };

export type OutboxRecord = OutboxMeta & TaskOperation;
