export interface SleepScheduleDto {
  /**
   * @pattern ^\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "23:00:00"
   */
  sleepStart: string;
  /**
   * @pattern ^\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "23:00:00"
   */
  wakeTime: string;
}
