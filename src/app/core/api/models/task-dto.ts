import type { TaskCategory } from './task-category';

import type { TaskPriority } from './task-priority';

export interface TaskDto {
  /** @format uuid */
  id: string;
  name: string;
  description?: string | null;
  type: TaskCategory;
  /** @format date */
  date: string;
  /** @format date-time */
  from?: string | null;
  /**
   * @pattern ^-?(\d+\.)?\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "08:00:00"
   */
  duration: string;
  priority: TaskPriority;
  /** @format date-time */
  deadline?: string | null;
  /** @format uuid */
  ownerId: string;
  /** @format date-time */
  created: string;
  /** @format date-time */
  updated: string;
  /** @format date-time */
  to: string;
  isCompleted: boolean;
  /** @format date-time */
  completedAt?: string | null;
  /** @format int32 */
  version: number;
}
