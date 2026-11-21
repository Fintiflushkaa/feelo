import type { TaskSyncStatus } from './task-sync-status';

export interface TaskSyncResult {
  status: TaskSyncStatus;
  errorMessage?: string | null;
}
