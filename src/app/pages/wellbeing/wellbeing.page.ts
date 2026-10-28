import { Component } from '@angular/core';
import { CheckinFormComponent } from '@features/wellbeing/ui/checkin-form/checkin-form.component';

@Component({
  selector: 'app-wellbeing-page',
  imports: [CheckinFormComponent],
  template: `
    <h1>Состояние</h1>
    <app-checkin-form />
  `,
})
export class WellbeingPage {}
