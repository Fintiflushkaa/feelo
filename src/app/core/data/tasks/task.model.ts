import type { TaskDto } from '@api/models/task-dto';
import type { UpdateTaskDto } from '@api/models/update-task-dto';

export type SyncState = 'synced' | 'pending' | 'failed' | 'conflicted';

type ServerTaskData = Pick<TaskDto, 'ownerId' | 'created' | 'updated' | 'version'>;

/** До подтверждения сервера значения nullable */
export type TaskServerFields = {
  [K in keyof ServerTaskData]: ServerTaskData[K] | null;
};

/** Модель чтения */
export interface Task extends Omit<Required<TaskDto>, keyof ServerTaskData | 'to'> {
  to: TaskDto['to'] | null;
  syncState: SyncState;
}

/**
 * Снимок локального создания, выведенный из общего TaskDto
 */
export type CreateTaskPayload = Omit<
  TaskDto,
  keyof ServerTaskData | 'to' | 'isCompleted' | 'completedAt'
>;

/** Нормализованные поля локального создания с ID. */
export type TaskData = Required<CreateTaskPayload>;
export type CreateTaskInput = Omit<CreateTaskPayload, 'id'>;

export type UpdateTaskInput = Partial<Pick<Task, Exclude<keyof UpdateTaskDto, 'version'>>>;
