import type { TaskDto } from '@api/models/task-dto';
import type { TaskDtoTaskSyncResult } from '@api/models/task-dto-task-sync-result';
import type { UpdateTaskDto } from '@api/models/update-task-dto';
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

/** Выбирает разрешённые поля: сохраняет false/null/пустую строку, пропускает undefined. */
function pickDefined<T extends object>(source: T, fields: Readonly<Record<keyof T, true>>): T {
  // Приведение ограничено обходом ключей; это не runtime-валидатор.
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

/** DateOnly: проверка календарной даты без изменения её строки/часового пояса. */
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

export function isTaskVersion(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= -2_147_483_648 &&
    value <= 2_147_483_647
  );
}

/** Create и update возвращают UUID → result; поддержана и прежняя одиночная аннотация API. */
export type TaskSyncResponse =
  | TaskDtoTaskSyncResult
  | Readonly<Record<string, TaskDtoTaskSyncResult>>;

function isSingleSyncResult(response: TaskSyncResponse): response is TaskDtoTaskSyncResult {
  return Object.hasOwn(response, 'status') && typeof response.status === 'string';
}

/** Разворачивает только свой ID. HttpClient<T> сам форму JSON не преобразует. */
export function taskSyncResultFor(
  taskId: string,
  response: TaskSyncResponse,
): TaskDtoTaskSyncResult {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error(`Некорректный ответ синхронизации для задачи ${taskId}`);
  }
  const result = isSingleSyncResult(response)
    ? response
    : Object.hasOwn(response, taskId)
      ? response[taskId]
      : undefined;
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    !Object.hasOwn(result, 'status') ||
    typeof result.status !== 'string'
  ) {
    throw new Error(`Сервер не вернул результат синхронизации для задачи ${taskId}`);
  }
  const normalized = { ...result };
  // Фактический JSON содержит null; сгенерированный DTO допускает только optional TaskDto.
  if (normalized.conflictedTask == null) delete normalized.conflictedTask;
  return normalized;
}

/** Сборка готового HTTP-запроса; неизвестная версия не подменяется нулём. */
export function taskPatchToDto(input: UpdateTaskInput, version: number): UpdateTaskDto {
  if (!isTaskVersion(version)) {
    throw new Error(
      'Для отправки изменения нужна подтверждённая серверная версия в диапазоне int32',
    );
  }

  return { ...taskInputToPatch(input), version };
}

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
    to: '0001-01-01T00:00:00Z',
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
