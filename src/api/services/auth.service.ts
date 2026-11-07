import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { UserDto } from '../models/user-dto';
import { LoginCreateParams } from '../models/login-create-params';
import { API_URL } from '../../app/core/api/api-url';
import { TokenStorageService } from '../../app/core/auth/token-storage.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStorageService);

  login(params: LoginCreateParams): Observable<string> {
    return this.http
      .post(`${API_URL}/auth/login`, null, { params: { ...params }, responseType: 'text' })
      .pipe(
        // Accept the documented JSON string and a plain-text JWT response.
        map((response) => {
          const value = response.trim();
          const token: unknown = value.startsWith('"') ? JSON.parse(value) : value;
          if (typeof token !== 'string' || !token) throw new Error('Empty authentication token');
          return token;
        }),
        tap((token) => this.tokens.setToken(token)),
      );
  }

  register(dto: UserDto): Observable<void> {
    return this.http
      .post(`${API_URL}/auth/register`, dto, { responseType: 'text' })
      .pipe(map(() => undefined));
  }
}
