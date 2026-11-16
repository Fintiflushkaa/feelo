import { SleepScheduleDto } from './sleep-schedule-dto';
import { AlarmUsage } from './alarm-usage';
import { PeakPreference } from './peak-preference';
import { DipPreference } from './dip-preference';

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
