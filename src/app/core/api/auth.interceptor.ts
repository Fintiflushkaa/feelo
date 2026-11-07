import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from './api-url';
import { TokenStorageService } from '../auth/token-storage.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(TokenStorageService);
  const router = inject(Router);
  const isApi = request.url.startsWith(`${API_URL}/`);
  const isPublic =
    request.url.split('?')[0] === `${API_URL}/auth/login` ||
    request.url.split('?')[0] === `${API_URL}/auth/register`;
  if (!isApi || isPublic) return next(request);

  const token = tokens.getToken();
  const authenticatedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const currentToken = tokens.getToken();
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        (!currentToken || currentToken === token)
      ) {
        tokens.clear();
        void router.navigateByUrl('/auth');
      }
      return throwError(() => error);
    }),
  );
};
