import { Component } from '@angular/core';
import { ProfilePage } from '../profile/profile.page';

@Component({
  selector: 'app-settings-page',
  imports: [ProfilePage],
  template: `<app-profile-page />`,
})
export class SettingsPage {}
