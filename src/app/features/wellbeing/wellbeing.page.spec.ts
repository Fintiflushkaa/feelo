import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '@api/api-url';
import { CircadianCurveDto } from '@api/models/circadian-curve-dto';
import { WellbeingPage } from './wellbeing.page';

describe('Rhythm page', () => {
  let fixture: ComponentFixture<WellbeingPage>;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WellbeingPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WellbeingPage);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function curvesRequest() {
    return http.expectOne(
      (request) =>
        request.url === `${API_URL}/circadian` &&
        request.params.get('date') === fixture.componentInstance.date,
    );
  }

  it('requests today and renders all five API curves and profile sleep data', () => {
    expect(fixture.nativeElement.textContent).toContain('Загружаем');
    const date = fixture.componentInstance.date;
    const curves: CircadianCurveDto[] = ['Routine', 'Mental', 'Physical', 'Social', 'General'].map(
      (kind) => ({
        kind: kind as CircadianCurveDto['kind'],
        windows: [],
        points: [
          { time: `${date}T06:00:00`, energy: 0.2 },
          { time: `${date}T12:00:00`, energy: 0.9 },
          { time: `${date}T18:00:00`, energy: 0.4 },
        ],
      }),
    );
    const request = curvesRequest();
    expect(request.request.method).toBe('GET');
    request.flush(curves);
    http.expectOne(`${API_URL}/profile`).flush({
      id: 'id',
      name: 'Антон',
      sleepProfile: {
        workDays: { sleepStart: '23:00:00', wakeTime: '07:00:00' },
        freeDays: { sleepStart: '00:00:00', wakeTime: '09:00:00' },
        requiredWakeTime: '07:00:00',
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.chart-line')).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('.chart h2').textContent).toBe(
      'Общий график активности',
    );
    expect(fixture.nativeElement.textContent).toContain('23:00 - 07:00');
    expect(fixture.nativeElement.querySelector('.wake-time').textContent).toBe('07:00');
    expect(fixture.nativeElement.querySelectorAll('.day-sleep').length).toBeGreaterThan(0);
  });

  it('keeps charts available when the sleep profile fails', () => {
    curvesRequest().flush([]);
    http.expectOne(`${API_URL}/profile`).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.chart')).toHaveLength(5);
    expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить режим сна');
    expect(fixture.nativeElement.textContent).toContain('Пока нет данных');
  });

  it('shows a retry action after a circadian request fails', () => {
    http.expectOne(`${API_URL}/profile`).flush({ id: 'id', name: 'Антон' });
    curvesRequest().flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить ритм');
    fixture.nativeElement.querySelector('.notice button').click();
    curvesRequest().flush([]);
    http.expectOne(`${API_URL}/profile`).flush({ id: 'id', name: 'Антон' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.chart')).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('.notice')).toBeNull();
  });
});
