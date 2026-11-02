import { Injectable } from '@angular/core';

/** Mock accounts live in memory until the page is reloaded. */
@Injectable({ providedIn: 'root' })
export class MockAuthService {
  private readonly accounts = new Map([
    ['demo@feelo.app', { username: 'Демо', password: 'feelo123' }],
  ]);

  register(username: string, email: string, password: string): string | null {
    const key = email.trim().toLowerCase();
    if (this.accounts.has(key)) return 'Этот email уже зарегистрирован. Войдите в аккаунт.';
    this.accounts.set(key, { username, password });
    return null;
  }

  login(email: string, password: string): boolean {
    if (this.accounts.get(email.trim().toLowerCase())?.password !== password) return false;
    localStorage.setItem('token', 'feelo-mock-session');
    return true;
  }
}
