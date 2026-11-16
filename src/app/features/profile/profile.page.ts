import { Component } from '@angular/core';
import { ProfileFormComponent } from '@features/profile/ui/profile-form/profile-form.component';

@Component({
  selector: 'app-profile-page',
  imports: [ProfileFormComponent],
  template: `
    <h1>Профиль</h1>
    <app-profile-form />
  `,
})
export class ProfilePage {}
