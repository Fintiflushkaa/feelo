import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  defer,
  EMPTY,
  exhaustMap,
  filter,
  from,
  fromEvent,
  merge,
  of,
  auditTime,
  Subscription,
  timer,
  withLatestFrom,
  type Observable,
} from 'rxjs';
import { DatabaseSessionService } from '@core/storage/database-session.service';
import { TaskRepositoryService } from './task.repository';
import { TaskSyncService, type TaskSyncReport } from './task-sync.service';

/** Активен только пока приложение открыто. providedIn:root сам по себе НЕ запускает сервис. */
@Injectable({ providedIn: 'root' })
export class TaskSyncScheduler {
  private readonly sender = inject(TaskSyncService);
  private readonly repository = inject(TaskRepositoryService);
  private readonly session = inject(DatabaseSessionService);
  private subscription: Subscription | undefined;
  readonly lastReport = signal<TaskSyncReport | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Идемпотентный запуск после open(userId); triggers можно подменить в тесте. */
  start(triggers?: Observable<unknown>): void {
    if (this.subscription) return;
    const browser =
      triggers ??
      merge(
        of(null),
        typeof window === 'undefined' ? EMPTY : fromEvent(window, 'online'),
        typeof document === 'undefined'
          ? EMPTY
          : fromEvent(document, 'visibilitychange').pipe(
              filter(() => document.visibilityState === 'visible'),
            ),
        timer(60_000, 60_000),
      );
    this.subscription = merge(
      browser,
      this.repository.changes$.pipe(auditTime(50)),
      this.session.db$,
    )
      .pipe(
        withLatestFrom(this.session.db$),
        filter(
          ([, db]) =>
            !!db && db.isOpen() && (typeof navigator === 'undefined' || navigator.onLine !== false),
        ),
        exhaustMap(() =>
          defer(() => from(this.sender.sync())).pipe(
            catchError(() => EMPTY), // Ошибка bootstrap/session не завершает поток триггеров навсегда.
          ),
        ),
      )
      .subscribe((report) => this.lastReport.set(report));
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }
}
