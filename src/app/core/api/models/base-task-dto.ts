import { TaskCategory } from './task-category';

export interface BaseTaskDto {
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
}
