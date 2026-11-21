import type { DipPreference } from './dip-preference';

import type { PeakPreference } from './peak-preference';

export interface RhythmPreferencesDto {
  generalPeak: PeakPreference;
  mentalPeak: PeakPreference;
  physicalPeak: PeakPreference;
  socialPeak: PeakPreference;
  routinePeak: PeakPreference;
  afternoonDip: DipPreference;
}
