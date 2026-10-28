import { Component } from '@angular/core';
import { ReminderSettingsComponent } from '@features/notifications/ui/reminder-settings/reminder-settings.component';

@Component({
  selector: 'app-settings-page',
  imports: [ReminderSettingsComponent],
  template: `
    <h1>Настройки</h1>
    <app-reminder-settings />
  `,
})
export class SettingsPage {}
