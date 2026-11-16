import { EnergyZone } from './energy-zone';

export interface CircadianWindowDto {
  /** @format date-time */
  start: string;
  /** @format date-time */
  end: string;
  zone: EnergyZone;
}
