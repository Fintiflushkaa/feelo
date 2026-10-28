import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** Промпт установки PWA. */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly canInstall$ = new BehaviorSubject<boolean>(false);
  private deferredPrompt: Event | null = null;

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event;
      this.canInstall$.next(true);
    });
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall$.next(false);
    });
  }

  canInstall(): Observable<boolean> {
    return this.canInstall$;
  }

  install(): void {
    if (!this.deferredPrompt) {
      return;
    }
    (this.deferredPrompt as unknown as { prompt(): void }).prompt();
  }
}
