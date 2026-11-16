import { TaskCategory } from './task-category';

export interface UpdateTaskDto {
  name?: string | null;
  description?: string | null;
  type?: TaskCategory;
  /** @format date-time */
  from?: string | null;
  /**
   * @pattern ^-?(\d+\.)?\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "08:00:00"
   */
  duration?: string | null;
}
