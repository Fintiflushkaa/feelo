import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthFormComponent } from './auth-form.component';
import { API_URL } from '../../../../core/api/api-url';

describe('Authentication form with API', () => {
  let component: AuthFormComponent;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AuthFormComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    component = TestBed.createComponent(AuthFormComponent).componentInstance;
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    component.form.setValue({ username: 'Имя', email: 'test@example.com', password: 'password' });
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('waits for registration, prevents duplicate submissions, then opens login', () => {
    component.submit();
    component.submit();
    expect(component.pending()).toBe(true);
    expect(component.mode()).toBe('register');
    http.expectOne(`${API_URL}/auth/register`).flush(null, { status: 201, statusText: 'Created' });
    expect(component.mode()).toBe('login');
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.email.value).toBe('test@example.com');
    expect(component.notice()).toContain('Аккаунт создан');
    expect(component.pending()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps registration open and explains an existing email', () => {
    component.submit();
    http.expectOne(`${API_URL}/auth/register`).flush(null, { status: 409, statusText: 'Conflict' });
    expect(component.mode()).toBe('register');
    expect(component.error()).toContain('уже зарегистрирован');
    expect(component.pending()).toBe(false);
  });

  it('shows incorrect credentials and allows retry', () => {
    component.switchMode('login');
    component.form.controls.password.setValue('password');
    component.submit();
    http
      .expectOne((r) => r.url === `${API_URL}/auth/login`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    expect(component.error()).toContain('Неверный email или пароль');
    expect(component.pending()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates home only after successful login', () => {
    component.switchMode('login');
    component.form.controls.password.setValue('password');
    component.submit();
    expect(navigate).not.toHaveBeenCalled();
    const token = `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    http.expectOne((r) => r.url === `${API_URL}/auth/login`).flush(JSON.stringify(token));
    expect(navigate).toHaveBeenCalledWith('/home');
    expect(localStorage.getItem('token')).toBe(token);
  });

  it('allows short existing passwords on login and reports network errors', () => {
    component.switchMode('login');
    component.form.controls.password.setValue('x');
    component.submit();
    http.expectOne((r) => r.url === `${API_URL}/auth/login`).error(new ProgressEvent('error'));
    expect(component.error()).toContain('Не удалось связаться');
    expect(component.pending()).toBe(false);
  });
});
