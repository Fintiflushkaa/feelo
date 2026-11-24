export interface PlanningSettingsDto {
  /**
   * @pattern ^-?(\d+\.)?\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "08:00:00"
   */
  baseDailyCapacity: string;
  /**
   * @pattern ^\d{2}:\d{2}:\d{2}(\.\d{1,7})?$
   * @example "23:00:00"
   */
  requiredWakeTime?: string | null;
}
