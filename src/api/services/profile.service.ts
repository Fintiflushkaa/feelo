import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserDto } from '../models/user-dto';
import { API_URL } from '../../app/core/api/api-url';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  getProfile(): Observable<UserDto> {
    return this.http.get<UserDto>(`${API_URL}/profile`);
  }
}
