import { EnergyCurveKind } from './energy-curve-kind';
import { EnergyPointDto } from './energy-point-dto';
import { CircadianWindowDto } from './circadian-window-dto';

export interface CircadianCurveDto {
  kind: EnergyCurveKind;
  points: EnergyPointDto[];
  windows: CircadianWindowDto[];
}
