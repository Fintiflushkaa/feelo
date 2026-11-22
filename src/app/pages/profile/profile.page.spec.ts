import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../core/api/api-url';
import { authInterceptor } from '../../core/api/auth.interceptor';
import { TokenStorageService } from '../../core/auth/token-storage.service';
import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  let fixture: ComponentFixture<ProfilePage>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: TokenStorageService, useValue: { getToken: () => 'session-token' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads and displays the authenticated profile instead of mock data', () => {
    expect(fixture.nativeElement.textContent).toContain('Загрузка профиля');
    const request = http.expectOne(`${API_URL}/profile`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    request.flush({ name: 'Мария', email: 'maria@example.com', password: '' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Мария');
    expect(fixture.nativeElement.textContent).toContain('Описание профиля');
    expect(fixture.nativeElement.textContent).not.toContain('Антон');
    expect(fixture.nativeElement.textContent).not.toContain('Загрузка профиля');
  });

  it('keeps the placeholder description when the API does not supply one', () => {
    http.expectOne(`${API_URL}/profile`).flush({ name: 'Мария', email: 'maria@example.com', password: '' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Мария');
    expect(fixture.nativeElement.querySelector('.profile__description').textContent)
      .toBe('Описание профиля');
  });

  it('allows retrying after a failed request', () => {
    http.expectOne(`${API_URL}/profile`).flush(null, { status: 500, statusText: 'Server error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('Не удалось загрузить профиль');
    fixture.nativeElement.querySelector('.profile__retry').click();
    http.expectOne(`${API_URL}/profile`).flush({ name: 'Мария', email: 'maria@example.com', password: '' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Мария');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});
