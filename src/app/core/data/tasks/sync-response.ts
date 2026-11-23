import type { TaskDto } from '@core/api/models/task-dto';
import type { TaskDtoTaskSyncResult } from '@core/api/models/task-dto-task-sync-result';
import type { TaskSyncStatus } from '@core/api/models/task-sync-status';

export type TaskSyncResponse =
  | TaskDtoTaskSyncResult
  | Readonly<Record<string, TaskDtoTaskSyncResult>>;

const statuses = {
  Created: true,
  Deleted: true,
  Modified: true,
  Synced: true,
  Conflicted: true,
  NotPlanned: true,
} satisfies Record<TaskSyncStatus, true>;

export class SyncResponseError extends Error {
  readonly code = 'invalid-response' as const;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isTaskVersion(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= -2_147_483_648 &&
    value <= 2_147_483_647
  );
}

/** HttpClient<T> не декодирует JSON. На границе принимается unknown, а не обещание DTO. */
export function taskSyncResultFor(taskId: string, response: unknown): TaskDtoTaskSyncResult {
  if (!isRecord(response))
    throw new SyncResponseError(`Некорректный ответ синхронизации для задачи ${taskId}`);
  const result =
    Object.hasOwn(response, 'status') && typeof response['status'] === 'string'
      ? response
      : Object.hasOwn(response, taskId)
        ? response[taskId]
        : undefined;
  if (
    !isRecord(result) ||
    !Object.hasOwn(result, 'status') ||
    typeof result['status'] !== 'string'
  ) {
    throw new SyncResponseError(`Сервер не вернул результат синхронизации для задачи ${taskId}`);
  }
  const status = result['status'];
  if (!Object.hasOwn(statuses, status))
    throw new SyncResponseError(`Неизвестный TaskSyncStatus: ${status}`);
  // После runtime-проверки ключа; новая ветка server enum обнаруживается satisfies выше.
  const normalized: TaskDtoTaskSyncResult = { status: status as TaskSyncStatus };
  if (result['version'] !== undefined) {
    if (result['version'] !== null && !isTaskVersion(result['version']))
      throw new SyncResponseError('Некорректная version в ACK');
    normalized.version = result['version'];
  }
  if (result['errorMessage'] !== undefined) {
    if (result['errorMessage'] !== null && typeof result['errorMessage'] !== 'string')
      throw new SyncResponseError('Некорректный errorMessage в ACK');
    normalized.errorMessage = result['errorMessage'];
  }
  if (result['conflictedTask'] != null) {
    if (!isRecord(result['conflictedTask']))
      throw new SyncResponseError('Некорректный конфликтный снимок');
    // Полная проверка снимка выполняется taskSnapshotFor перед любым сохранением.
    normalized.conflictedTask = result['conflictedTask'] as unknown as TaskDto;
  }
  return normalized;
}
