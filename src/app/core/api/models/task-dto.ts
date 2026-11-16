import { TaskCategory } from './task-category';

export interface TaskDto {
  name: string;
  description: string;
  type: TaskCategory;
  /** @format date-time */
  from: string;
  /**
   * @pattern ^-?(\d+\.)?\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "08:00:00"
   */
  duration: string;
  /** @format uuid */
  ownerId: string;
  /** @format uuid */
  id: string;
  /** @format date-time */
  created: string;
  /** @format date-time */
  updated: string;
  /** @format date-time */
  to: string;
}
