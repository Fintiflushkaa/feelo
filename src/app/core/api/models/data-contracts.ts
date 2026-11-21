/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export type TaskSyncStatus =
  | "Created"
  | "Deleted"
  | "Modified"
  | "Synced"
  | "Conflicted"
  | "NotPlanned";

export type TaskPriority = "Low" | "Normal" | "High";

export type TaskCategory = "Physical" | "Social" | "Mental" | "Routine";

export type PeakPreference =
  | "Morning"
  | "AroundNoon"
  | "Afternoon"
  | "Evening"
  | "Night"
  | "NoDifference";

export type EnergyZone = "Low" | "Normal" | "Peak";

export type EnergyCurveKind =
  | "General"
  | "Mental"
  | "Physical"
  | "Social"
  | "Routine";

export type DipPreference =
  | "From12To14"
  | "From14To16"
  | "From16To18"
  | "After18"
  | "NoNoticeableDip";

export type AlarmUsage = "None" | "Sometimes" | "Always";

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

export interface CircadianCurveDto {
  kind: EnergyCurveKind;
  points: EnergyPointDto[];
  windows: CircadianWindowDto[];
}

export interface CircadianWindowDto {
  /** @format date-time */
  start: string;
  /** @format date-time */
  end: string;
  zone: EnergyZone;
}

export interface EnergyPointDto {
  /** @format date-time */
  time: string;
  /** @format double */
  energy: number;
}

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

export interface ProfileDto {
  /** @format uuid */
  id: string;
  name: string;
  sleepProfile?: SleepProfileDto;
  rhythmPreferences?: RhythmPreferencesDto;
  planningSettings?: PlanningSettingsDto;
  /** @format date-time */
  onboardingCompletedAt?: string | null;
}

export interface RhythmPreferencesDto {
  generalPeak: PeakPreference;
  mentalPeak: PeakPreference;
  physicalPeak: PeakPreference;
  socialPeak: PeakPreference;
  routinePeak: PeakPreference;
  afternoonDip: DipPreference;
}

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

export interface TaskDto {
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
  /** @format uuid */
  ownerId: string;
  /** @format date-time */
  created: string;
  /** @format date-time */
  updated: string;
  /** @format date-time */
  to: string;
  /** @format int32 */
  version: number;
}

export interface TaskSyncResult {
  status: TaskSyncStatus;
  errorMessage?: string | null;
}

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
  priority?: TaskPriority;
  /** @format date-time */
  deadline?: string | null;
}

export interface UserDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginCreateParams {
  email: string;
  password: string;
}

export type CreatemanyCreatePayload = BaseTaskDto[];

export interface TasksUpdateParams {
  /** @format uuid */
  taskId: string;
}

export interface TasksDeleteParams {
  /** @format uuid */
  taskId: string;
}

export interface CircadianListParams {
  /** @format date */
  date?: string;
}
