import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** Единая обработка HTTP-ошибок. */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Login credentials are query parameters: do not log the request URL or error object.
      console.error('[api] request failed', req.method, error.status);
      return throwError(() => error);
    }),
  );
