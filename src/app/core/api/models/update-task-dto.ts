import type { TaskCategory } from './task-category';

import type { TaskPriority } from './task-priority';

export interface UpdateTaskDto {
  name?: string | null;
  description?: string | null;
  type?: TaskCategory;
  /** @format date-time */
  from?: string | null;
  /** @format date */
  date?: string | null;
  /**
   * @pattern ^-?(\d+\.)?\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "08:00:00"
   */
  duration?: string | null;
  priority?: TaskPriority;
  /** @format date-time */
  deadline?: string | null;
  /** @format int32 */
  version: number;
  isCompleted?: boolean | null;
  /** @format date-time */
  completedAt?: string | null;
}
