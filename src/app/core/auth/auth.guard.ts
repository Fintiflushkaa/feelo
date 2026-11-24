import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TokenStorageService } from '../auth/token-storage.service';

export const authGuard = () => {
  const router = inject(Router);
  return inject(TokenStorageService).getToken() ? true : router.createUrlTree(['/auth']);
};
