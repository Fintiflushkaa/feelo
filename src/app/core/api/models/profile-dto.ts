import type { PlanningSettingsDto } from './planning-settings-dto';

import type { RhythmPreferencesDto } from './rhythm-preferences-dto';

import type { SleepProfileDto } from './sleep-profile-dto';

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
