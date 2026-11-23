import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import type { TaskSyncStatus } from '@core/api/models/task-sync-status';
import type { OutboxState, SyncErrorCode } from '@core/storage/storage.models';

export function syncVerdict(
  action: 'create' | 'update',
  status: TaskSyncStatus,
): 'accepted' | 'conflicted' | 'not-planned' | 'rejected' {
  switch (status) {
    case 'Created':
      return action === 'create' ? 'accepted' : 'rejected';
    case 'Modified':
      return action === 'update' ? 'accepted' : 'rejected';
    case 'Synced':
      return 'accepted';
    case 'Conflicted':
      return 'conflicted';
    case 'NotPlanned':
      return 'not-planned';
    case 'Deleted':
      return 'rejected';
    default:
      throw new Error(`Неизвестный TaskSyncStatus: ${status satisfies never}`);
  }
}

export function retryDelay(attempts: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.min(Math.max(0, attempts - 1), 6));
}

export function failurePolicy(
  error: unknown,
  attempts: number,
): {
  state: OutboxState;
  delay: number;
  stop: 'unauthorized' | 'retry-later' | null;
  code: SyncErrorCode;
} {
  const status = error instanceof HttpErrorResponse ? error.status : null;
  if (status === 401 || status === 403)
    return { state: 'pending', delay: 0, stop: 'unauthorized', code: 'unauthorized' };
  if (
    error instanceof TimeoutError ||
    status === 0 ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status !== null && status >= 500)
  ) {
    return {
      state: 'pending',
      delay: retryDelay(attempts),
      stop: 'retry-later',
      code: 'http-transient',
    };
  }
  if (status === 409) return { state: 'conflicted', delay: 0, stop: null, code: 'conflict' };
  return {
    state: 'failed',
    delay: 0,
    stop: null,
    code: status === null ? 'request-error' : 'http-rejected',
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : error instanceof HttpErrorResponse
      ? error.message
      : String(error);
}

export function isHttpFailure(error: unknown): boolean {
  return error instanceof HttpErrorResponse || error instanceof TimeoutError;
}
