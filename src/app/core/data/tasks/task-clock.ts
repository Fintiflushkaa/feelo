import { InjectionToken } from '@angular/core';

export const TASK_CLOCK = new InjectionToken<() => number>('TASK_CLOCK', {
  providedIn: 'root',
  factory: () => () => Date.now(),
});
