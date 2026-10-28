import { Component } from '@angular/core';
import { SleepSetupFormComponent } from '@features/onboarding/ui/sleep-setup-form/sleep-setup-form.component';

@Component({
  selector: 'app-onboarding-page',
  imports: [SleepSetupFormComponent],
  template: `
    <h1>Онбординг</h1>
    <app-sleep-setup-form />
  `,
})
export class OnboardingPage {}
