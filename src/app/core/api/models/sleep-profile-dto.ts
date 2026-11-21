import type { AlarmUsage } from './alarm-usage';

import type { SleepScheduleDto } from './sleep-schedule-dto';

export interface SleepProfileDto {
  workDays: SleepScheduleDto;
  freeDays: SleepScheduleDto;
  /**
   * @pattern ^-?(\d+\.)?\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "08:00:00"
   */
  desiredSleepDuration: string;
  freeDayAlarmUsage: AlarmUsage;
  /**
   * @pattern ^\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "23:00:00"
   */
  requiredWakeTime?: string | null;
}
