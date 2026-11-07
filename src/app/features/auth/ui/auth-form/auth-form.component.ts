import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../../../../api/services/auth.service';

@Component({
  selector: 'app-auth-form',
  imports: [ReactiveFormsModule],
  templateUrl: './auth-form.component.html',
  styleUrl: './auth-form.component.scss',
})
export class AuthFormComponent {
  private readonly builder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly mode = signal<'register' | 'login'>('register');
  readonly error = signal('');
  readonly notice = signal('');
  readonly pending = signal(false);
  readonly form = this.builder.nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  switchMode(mode: 'register' | 'login'): void {
    if (this.pending()) return;
    this.mode.set(mode);
    this.error.set('');
    this.notice.set('');
    if (mode === 'login') this.form.controls.username.disable();
    else this.form.controls.username.enable();
    this.form.controls.password.reset('');
    this.form.controls.password.setValidators(
      mode === 'register' ? [Validators.required, Validators.minLength(6)] : [Validators.required],
    );
    this.form.controls.password.updateValueAndValidity();
    this.form.markAsUntouched();
  }

  submit(): void {
    if (this.pending()) return;
    this.error.set('');
    this.notice.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { username, email, password } = this.form.getRawValue();
    const registering = this.mode() === 'register';
    const credentials = { email: email.trim(), password };
    this.pending.set(true);
    const request: Observable<unknown> = registering
      ? this.auth.register({ name: username.trim(), ...credentials })
      : this.auth.login(credentials);
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: () => {
          this.pending.set(false);
          if (registering) {
            this.switchMode('login');
            this.notice.set('Аккаунт создан. Войдите с вашим email и паролем.');
          } else {
            void this.router.navigateByUrl('/home');
          }
        },
        error: (error: unknown) => this.error.set(this.errorMessage(error, registering)),
      });
  }

  private errorMessage(error: unknown, registering: boolean): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0)
        return 'Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.';
      if (registering && error.status === 409)
        return 'Этот email уже зарегистрирован. Войдите в аккаунт.';
      if (!registering && [400, 401, 404].includes(error.status))
        return 'Неверный email или пароль. Попробуйте ещё раз.';
      if (error.status === 400 || error.status === 422)
        return 'Проверьте введённые данные. Сервер отклонил запрос.';
      if (error.status === 429) return 'Слишком много попыток. Попробуйте немного позже.';
    }
    return 'Не удалось выполнить запрос. Попробуйте позже.';
  }
}
