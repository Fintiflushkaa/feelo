import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { API_URL } from '../../app/core/api/api-url';
import { TokenStorageService } from '../../app/core/auth/token-storage.service';
import { authInterceptor } from '../../app/core/api/auth.interceptor';

const jwt = (exp = Math.floor(Date.now() / 1000) + 3600) =>
  `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ exp }))}.signature`;

describe('API authentication', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let tokens: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    tokens = TestBed.inject(TokenStorageService);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('sends login credentials as query parameters and saves a JSON JWT string', () => {
    const token = jwt();
    auth.login({ email: 'user+test@example.com', password: 'p&a?=+#' }).subscribe();
    const req = http.expectOne((r) => r.url === `${API_URL}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.params.get('email')).toBe('user+test@example.com');
    expect(req.request.params.get('password')).toBe('p&a?=+#');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(JSON.stringify(token));
    expect(tokens.getToken()).toBe(token);
  });

  it('also accepts a plain text JWT', () => {
    const token = jwt();
    auth.login({ email: 'test@example.com', password: 'password' }).subscribe();
    http.expectOne((r) => r.url === `${API_URL}/auth/login`).flush(token);
    expect(tokens.getToken()).toBe(token);
  });

  it('registers without an id, token, or automatic login', () => {
    const user = { name: 'Тест', email: 'test@example.com', password: 'password' };
    auth.register(user).subscribe();
    const req = http.expectOne(`${API_URL}/auth/register`);
    expect(req.request.body).toEqual(user);
    req.flush(null, { status: 201, statusText: 'Created' });
    expect(tokens.getToken()).toBeNull();
  });

  it('rejects malformed responses without saving a session', () => {
    let failed = false;
    auth
      .login({ email: 'test@example.com', password: 'password' })
      .subscribe({ error: () => (failed = true) });
    http.expectOne((r) => r.url === `${API_URL}/auth/login`).flush('feelo-mock-session');
    expect(failed).toBe(true);
    expect(tokens.getToken()).toBeNull();
  });

  it('removes expired JWTs and old mock sessions', () => {
    for (const token of [jwt(1), 'feelo-mock-session', 'a.b.c']) {
      localStorage.setItem('token', token);
      expect(tokens.getToken()).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    }
  });

  it('adds Bearer only to protected requests to this API', () => {
    const client = TestBed.inject(HttpClient);
    const token = jwt();
    tokens.setToken(token);
    client.get(`${API_URL}/tasks`).subscribe();
    const req = http.expectOne(`${API_URL}/tasks`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush([]);
    client.get('https://other.example/tasks').subscribe();
    const external = http.expectOne('https://other.example/tasks');
    expect(external.request.headers.has('Authorization')).toBe(false);
    external.flush([]);
  });

  it('clears rejected sessions and redirects to authentication on protected 401', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    tokens.setToken(jwt());
    TestBed.inject(HttpClient)
      .get(`${API_URL}/tasks`)
      .subscribe({ error: () => {} });
    http.expectOne(`${API_URL}/tasks`).flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(tokens.getToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/auth');
  });
});
