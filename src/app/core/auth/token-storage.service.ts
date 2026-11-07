import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  getToken(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    if (!this.isCurrent(token)) {
      this.clear();
      return null;
    }
    return token;
  }

  setToken(token: string): void {
    if (!this.isCurrent(token)) throw new Error('Invalid authentication token');
    localStorage.setItem('token', token);
  }

  clear(): void {
    localStorage.removeItem('token');
  }

  // This only checks structure and expiry. The server verifies the signature.
  private isCurrent(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3 || parts.some((part) => !part)) return false;
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
      return typeof claims.exp === 'number' && claims.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}
