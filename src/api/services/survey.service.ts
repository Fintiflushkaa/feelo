import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { SurveyAnswerDto } from '../models/survey-answer-dto';
import { API_URL } from '../../app/core/api/api-url';

@Injectable({ providedIn: 'root' })
export class SurveyService {
  private readonly http = inject(HttpClient);

  submit(answers: SurveyAnswerDto): Observable<void> {
    return this.http
      .post(`${API_URL}/survey/submit`, answers, { responseType: 'text' })
      .pipe(map(() => undefined));
  }
}
