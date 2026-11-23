import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../api-url';
import { ProfileDto } from '../models/profile-dto';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  http = inject(HttpClient);

  get() {
    return this.http.get<ProfileDto>(`${API_URL}/profile`);
  }
}
