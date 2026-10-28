import { Component } from '@angular/core';
import { AuthFormComponent } from '@features/auth/ui/auth-form/auth-form.component';

@Component({
  selector: 'app-auth-page',
  imports: [AuthFormComponent],
  template: ` <app-auth-form /> `,
})
export class AuthPage {}
