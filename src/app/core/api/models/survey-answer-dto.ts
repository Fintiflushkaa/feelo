import type { AlarmUsage } from './alarm-usage';

import type { DipPreference } from './dip-preference';

import type { PeakPreference } from './peak-preference';

import type { SleepScheduleDto } from './sleep-schedule-dto';

export interface SurveyAnswerDto {
  workDaySleepSchedule: SleepScheduleDto;
  freeDaySleepSchedule: SleepScheduleDto;
  /**
   * @pattern ^-?(\d+\.)?\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "08:00:00"
   */
  desiredSleepDuration: string;
  /**
   * @pattern ^\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "23:00:00"
   */
  requiredWakeTime?: string | null;
  alarmUsage: AlarmUsage;
  generalPeak: PeakPreference;
  mentalPeak: PeakPreference;
  physicalPeak: PeakPreference;
  socialPeak: PeakPreference;
  routinePeak: PeakPreference;
  afternoonDip: DipPreference;
}
