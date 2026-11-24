import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../api-url';
import { CircadianCurveDto } from '../models/circadian-curve-dto';
import { CircadianListParams } from '../models/circadian-list-params';

@Injectable({ providedIn: 'root' })
export class CircadianService {
  private readonly http = inject(HttpClient);

  get(params: CircadianListParams = {}) {
    return this.http.get<CircadianCurveDto[]>(`${API_URL}/circadian`, {
      params: params.date ? { date: params.date } : {},
    });
  }
}
