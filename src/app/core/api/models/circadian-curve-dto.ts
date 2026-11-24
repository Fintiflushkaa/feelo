import type { CircadianWindowDto } from './circadian-window-dto';

import type { EnergyCurveKind } from './energy-curve-kind';

import type { EnergyPointDto } from './energy-point-dto';

export interface CircadianCurveDto {
  kind: EnergyCurveKind;
  points: EnergyPointDto[];
  windows: CircadianWindowDto[];
}
