import type {
  CreateTaskPayload,
  SyncState,
  Task,
  TaskServerFields,
  UpdateTaskInput,
} from '../data/tasks/task.model';

/** Общая задача + серверные поля + локальные метаданные. */
export interface TaskRecord extends Task, TaskServerFields {
  localRevision: number;
  localUpdatedAt: number;
  deletedAt: number | null;
  needsRefresh?: true;
}

export type OutboxState = Exclude<SyncState, 'synced'>;

export interface OutboxMeta {
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
  | { action: 'update'; payload: UpdateTaskInput; requestVersion?: number }
  | { action: 'delete'; payload: null };

export type OutboxRecord = OutboxMeta & TaskOperation;
