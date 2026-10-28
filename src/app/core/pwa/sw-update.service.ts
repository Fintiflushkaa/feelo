import { Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { BehaviorSubject, Observable } from 'rxjs';

/** Обработка обновлений сервис-воркера. */
@Injectable({ providedIn: 'root' })
export class SwUpdateService {
  private readonly available$ = new BehaviorSubject<boolean>(false);

  constructor(private readonly swUpdate: SwUpdate) {
    this.swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this.available$.next(true);
      }
    });
  }

  available(): Observable<boolean> {
    return this.available$;
  }

  activateUpdate(): void {
    this.swUpdate.activateUpdate().then(() => window.location.reload());
  }
}
