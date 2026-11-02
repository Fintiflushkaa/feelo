import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MockAuthService } from '../../mock-auth.service';

@Component({
  selector: 'app-auth-form',
  imports: [ReactiveFormsModule],
  templateUrl: './auth-form.component.html',
  styleUrl: './auth-form.component.scss',
})
export class AuthFormComponent {
  private readonly builder = inject(FormBuilder);
  private readonly auth = inject(MockAuthService);
  private readonly router = inject(Router);
  readonly mode = signal<'register' | 'login'>('register');
  readonly error = signal('');
  readonly notice = signal('');
  readonly form = this.builder.nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  switchMode(mode: 'register' | 'login'): void {
    this.mode.set(mode);
    this.error.set('');
    this.notice.set('');
    if (mode === 'login') this.form.controls.username.disable();
    else this.form.controls.username.enable();
    this.form.controls.password.reset('');
    this.form.markAsUntouched();
  }

  submit(): void {
    this.error.set('');
    this.notice.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { username, email, password } = this.form.getRawValue();
    if (this.mode() === 'register') {
      const error = this.auth.register(username.trim(), email, password);
      if (error) {
        this.error.set(error);
        return;
      }
      this.switchMode('login');
      this.notice.set('Аккаунт создан. Войдите с вашим email и паролем.');
    } else if (this.auth.login(email, password)) {
      void this.router.navigateByUrl('/home');
    } else {
      this.error.set('Неверный email или пароль. Попробуйте ещё раз.');
    }
  }
}
