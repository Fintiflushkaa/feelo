import { Component } from '@angular/core';
import { TimelineComponent } from '@features/schedule/ui/timeline/timeline.component';

@Component({
  selector: 'app-schedule-page',
  imports: [TimelineComponent],
  template: `
    <h1>Расписание</h1>
    <app-timeline />
  `,
})
export class SchedulePage {}
