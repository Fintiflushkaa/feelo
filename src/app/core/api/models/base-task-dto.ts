import type { TaskCategory } from './task-category';

import type { TaskPriority } from './task-priority';

export interface BaseTaskDto {
  /** @format uuid */
  id: string;
  name: string;
  description?: string | null;
  type: TaskCategory;
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
}
