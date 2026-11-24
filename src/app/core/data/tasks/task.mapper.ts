import { isRecord, isTaskVersion, SyncResponseError } from './sync-response';
import type { TaskDto } from '@core/api/models/task-dto';
import type { UpdateTaskDto } from '@core/api/models/update-task-dto';
import type { TaskRecord } from '@core/storage/storage.models';
import type {
  CreateTaskInput,
  CreateTaskPayload,
  Task,
  TaskData,
  UpdateTaskInput,
} from './task.model';

const createTaskFields = {
  id: true,
  name: true,
  description: true,
  type: true,
  date: true,
  from: true,
  duration: true,
  priority: true,
  deadline: true,
} satisfies Record<keyof CreateTaskPayload, true>;

const updateTaskFields = {
  name: true,
  description: true,
  type: true,
  from: true,
  date: true,
  duration: true,
  priority: true,
  deadline: true,
  isCompleted: true,
  completedAt: true,
} satisfies Record<keyof UpdateTaskInput, true>;

function pickDefined<T extends object>(source: T, fields: Readonly<Record<keyof T, true>>): T {
  const result = {} as T;

  for (const key of Object.keys(fields) as Array<keyof T>) {
    const value = source[key];
    if (value !== undefined) result[key] = value;
  }

  return result;
}

function taskData(source: CreateTaskPayload): TaskData {
  const fields = pickDefined<CreateTaskPayload>(source, createTaskFields);

  return {
    ...fields,
    description: fields.description ?? null,
    from: fields.from ?? null,
    deadline: fields.deadline ?? null,
  };
}

export function isTaskDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-'))
    return false;
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === value
  );
}

export function createTaskData(id: string, input: CreateTaskInput): TaskData {
  if (!isTaskDate(input.date)) throw new Error('Укажите дату задачи в формате YYYY-MM-DD');
  return taskData({ ...input, id });
}

export function taskInputToPatch(input: UpdateTaskInput): UpdateTaskInput {
  const patch = pickDefined<UpdateTaskInput>(input, updateTaskFields);
  if (patch.date !== undefined && !isTaskDate(patch.date))
    throw new Error('Укажите дату задачи в формате YYYY-MM-DD');
  return patch satisfies Omit<UpdateTaskDto, 'version'>;
}

export { isTaskVersion, taskSyncResultFor } from './sync-response';
export type { TaskSyncResponse } from './sync-response';

export function taskPatchToDto(input: UpdateTaskInput, version: number): UpdateTaskDto {
  if (!isTaskVersion(version)) {
    throw new Error(
      'Для отправки изменения нужна подтверждённая серверная версия в диапазоне int32',
    );
  }

  return { ...taskInputToPatch(input), version };
}

export const UNPLANNED_TASK_END = '0001-01-01T00:00:00Z';

export function taskCreateToDto(
  payload: CreateTaskPayload,
  ownerId: string,
  createdAt: number,
): TaskDto {
  const data = taskData(payload);
  if (!isTaskDate(data.date)) {
    throw new Error(
      'В create-команде отсутствует корректная date; нужна миграция, а не сегодняшняя дата',
    );
  }
  const created = new Date(createdAt).toISOString();
  return {
    ...data,
    ownerId,
    created,
    updated: created,
    to: UNPLANNED_TASK_END,
    version: 0,
    isCompleted: false,
    completedAt: null,
  };
}

export function taskDtoToRecord(dto: TaskDto): TaskRecord {
  return {
    ...taskData(dto),
    ownerId: dto.ownerId,
    created: dto.created,
    updated: dto.updated,
    version: dto.version,
    to: dto.to ?? null,
    isCompleted: dto.isCompleted,
    completedAt: dto.completedAt ?? null,
    syncState: 'synced',
    localRevision: 0,
    localUpdatedAt: 0,
    deletedAt: null,
  };
}

export function taskRecordToTask(record: TaskRecord): Task {
  return {
    ...taskData(record),
    to: record.to ?? null,
    isCompleted: record.isCompleted,
    completedAt: record.completedAt ?? null,
    syncState: record.syncState,
  };
}

export function taskSnapshotFor(
  response: unknown,
  ownerId: string,
): { records: TaskRecord[]; rejected: number; seenIds: string[] } {
  if (!Array.isArray(response)) throw new SyncResponseError('GET задач вернул не массив');
  const records: TaskRecord[] = [];
  let rejected = 0;
  const seenIds: string[] = [];
  for (const row of response) {
    if (isRecord(row) && typeof row['id'] === 'string') seenIds.push(row['id']);
    const strings = [
      'id',
      'name',
      'type',
      'duration',
      'priority',
      'ownerId',
      'created',
      'updated',
      'to',
    ];
    const nullable = ['description', 'from', 'deadline', 'completedAt'];
    if (
      !isRecord(row) ||
      !strings.every((key) => typeof row[key] === 'string') ||
      !nullable.every((key) => row[key] == null || typeof row[key] === 'string') ||
      typeof row['isCompleted'] !== 'boolean' ||
      !isTaskDate(row['date']) ||
      !isTaskVersion(row['version']) ||
      (row['ownerId'] as string).toLowerCase() !== ownerId.toLowerCase()
    ) {
      rejected += 1;
      continue;
    }
    records.push(taskDtoToRecord(row as unknown as TaskDto));
  }
  return { records, rejected, seenIds };
}
