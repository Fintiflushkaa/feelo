import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { SleepSetupFormComponent } from './sleep-setup-form.component';
import { API_URL } from '../../../../core/api/api-url';
import { authInterceptor } from '../../../../core/api/auth.interceptor';
import { TokenStorageService } from '../../../../core/auth/token-storage.service';

describe('Sleep survey', () => {
  let fixture: ComponentFixture<SleepSetupFormComponent>;
  let component: SleepSetupFormComponent;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [SleepSetupFormComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const token = `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    TestBed.inject(TokenStorageService).setToken(token);
    fixture = TestBed.createComponent(SleepSetupFormComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  function fillAnswers(): void {
    component.form.patchValue({
      workWake: '07:30',
      workSleep: '23:15',
      duration: 8.5,
      restriction: 'no',
      freeSleep: '00:30',
      freeWake: '09:00',
      alarmUsage: 'Sometimes',
      generalPeak: 'Morning',
      mentalPeak: 'AroundNoon',
      physicalPeak: 'Afternoon',
      socialPeak: 'Evening',
      routinePeak: 'NoDifference',
      afternoonDip: 'From14To16',
    });
  }

  function finish(): void {
    for (let i = 0; i < 13; i++) {
      (fixture.nativeElement.querySelector('button.next') as HTMLButtonElement).click();
      fixture.detectChanges();
    }
  }

  it('handles the Next button through Angular and prevents native form navigation', () => {
    const submissions: Event[] = [];
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.addEventListener('submit', (event) => submissions.push(event));
    const next: HTMLButtonElement = fixture.nativeElement.querySelector('button.next');

    next.click();
    fixture.detectChanges();
    expect(submissions).toHaveLength(1);
    expect(submissions[0].defaultPrevented).toBe(true);
    expect(component.step()).toBe(0);

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=time]');
    input.value = '07:30';
    input.dispatchEvent(new Event('input'));
    next.click();
    fixture.detectChanges();

    expect(submissions).toHaveLength(2);
    expect(submissions[1].defaultPrevented).toBe(true);
    expect(component.step()).toBe(1);
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('засыпаете по будням');
    expect(fixture.nativeElement.querySelector('.counter').textContent).toContain('2 / 13');
    expect(navigate).not.toHaveBeenCalled();
    http.expectNone(`${API_URL}/survey/submit`);
  });

  it('validates a time and preserves answers when navigating backwards', () => {
    component.next();
    fixture.detectChanges();
    expect(component.step()).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Укажите корректное время');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=time]');
    input.value = '07:30';
    input.dispatchEvent(new Event('input'));
    component.next();
    fixture.detectChanges();
    expect(component.step()).toBe(1);
    component.back();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input').value).toBe('07:30');
    component.back();
    expect(component.step()).toBe(0);
  });

  it('requires a wake deadline only when there is a restriction', () => {
    fillAnswers();
    component.step.set(3);
    component.form.controls.restriction.setValue('yes');
    component.next();
    expect(component.step()).toBe(3);
    component.form.controls.requiredWakeTime.setValue('06:45');
    component.next();
    expect(component.step()).toBe(4);
    component.back();
    component.form.controls.restriction.setValue('no');
    expect(component.form.controls.requiredWakeTime.disabled).toBe(true);
    component.next();
    expect(component.step()).toBe(4);
  });

  it('binds choices to each step separately, including consecutive peak questions', () => {
    fillAnswers();
    component.step.set(7);
    fixture.detectChanges();
    (fixture.nativeElement.querySelectorAll('input[type=radio]')[4] as HTMLInputElement).click();
    component.next();
    fixture.detectChanges();
    (fixture.nativeElement.querySelectorAll('input[type=radio]')[3] as HTMLInputElement).click();
    expect(component.form.controls.generalPeak.value).toBe('Night');
    expect(component.form.controls.mentalPeak.value).toBe('Evening');
    component.back();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input[type=radio]')[4].checked).toBe(true);
  });

  it('submits the full DTO once with authorization and navigates only after success', () => {
    fillAnswers();
    finish();
    component.next();
    component.back();
    expect(component.pending()).toBe(true);
    expect(component.step()).toBe(12);
    expect(navigate).not.toHaveBeenCalled();
    const request = http.expectOne(`${API_URL}/survey/submit`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toMatch(/^Bearer /);
    expect(request.request.body).toEqual({
      workDaySleepSchedule: { sleepStart: '23:15:00', wakeTime: '07:30:00' },
      freeDaySleepSchedule: { sleepStart: '00:30:00', wakeTime: '09:00:00' },
      desiredSleepDuration: '08:30:00',
      requiredWakeTime: null,
      alarmUsage: 'Sometimes',
      generalPeak: 'Morning',
      mentalPeak: 'AroundNoon',
      physicalPeak: 'Afternoon',
      socialPeak: 'Evening',
      routinePeak: 'NoDifference',
      afternoonDip: 'From14To16',
    });
    request.flush(null);
    expect(navigate).toHaveBeenCalledWith('/home');
    expect(component.pending()).toBe(false);
  });

  it('keeps answers on failure and allows retry with the wake deadline', () => {
    fillAnswers();
    component.form.patchValue({ restriction: 'yes', requiredWakeTime: '06:45' });
    finish();
    http.expectOne(`${API_URL}/survey/submit`).error(new ProgressEvent('error'));
    expect(component.error()).toContain('Не удалось отправить');
    expect(component.pending()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    component.next();
    const retry = http.expectOne(`${API_URL}/survey/submit`);
    expect(retry.request.body.requiredWakeTime).toBe('06:45:00');
    retry.flush('');
    expect(navigate).toHaveBeenCalledWith('/home');
  });

  it('rejects invalid durations and serializes a full day in TimeSpan format', () => {
    fillAnswers();
    component.step.set(2);
    for (const duration of [null, 0, -1, 25]) {
      component.form.controls.duration.setValue(duration);
      component.next();
      expect(component.step()).toBe(2);
    }
    component.form.controls.duration.setValue(24);
    component.step.set(12);
    component.next();
    const request = http.expectOne(`${API_URL}/survey/submit`);
    expect(request.request.body.desiredSleepDuration).toBe('1.00:00:00');
    request.flush('');
  });
});
