import type { TaskDto } from './task-dto';

import type { TaskSyncStatus } from './task-sync-status';

export interface TaskDtoTaskSyncResult {
  /** @format int32 */
  version?: number | null;
  status: TaskSyncStatus;
  conflictedTask?: TaskDto;
  errorMessage?: string | null;
}
