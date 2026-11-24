import { inject, Injectable } from '@angular/core';
import {
  filter,
  firstValueFrom,
  from,
  map,
  of,
  shareReplay,
  Subject,
  take,
  switchMap,
  takeUntil,
  type Observable,
} from 'rxjs';

import { TasksService } from '@core/api/services/tasks.service';
import { DatabaseSessionService } from '@core/storage/database-session.service';
import type { FeeloDb } from '@core/storage/db';
import { createTaskData, taskSnapshotFor, taskInputToPatch, taskRecordToTask } from './task.mapper';
import { TASK_CLOCK } from './task-clock';
import { newTaskId } from './task-id';
import type { CreateTaskInput, Task, UpdateTaskInput } from './task.model';
import { TaskStore } from '@core/storage/task/task.storage';

@Injectable({ providedIn: 'root' })
export class TaskRepositoryService {
  private readonly api = inject(TasksService);
  private readonly dbSession = inject(DatabaseSessionService);

  private readonly now = inject(TASK_CLOCK);
  private readonly changes = new Subject<void>();
  readonly changes$ = this.changes.asObservable();

  private readonly workRequests = new WeakMap<FeeloDb, Promise<void>>();

  readonly tasks$: Observable<readonly Task[]> = this.dbSession.db$.pipe(
    switchMap((db) => {
      if (!db) {
        return of<readonly Task[]>([]);
      }

      return from(new TaskStore(db, this.now).observeActive()).pipe(
        map((records) => records.map(taskRecordToTask)),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  async refresh(): Promise<void> {
    const db = this.dbSession.requireDb();
    const existing = this.workRequests.get(db);

    if (existing) {
      return existing;
    }

    const request = this.fetchAndSave(db).finally(() => {
      this.workRequests.delete(db);
    });

    this.workRequests.set(db, request);
    return request;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const db = this.dbSession.requireDb();
    const data = createTaskData(newTaskId(), input);
    const record = await new TaskStore(db, this.now).create(data);

    this.changes.next();
    return taskRecordToTask(record);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const db = this.dbSession.requireDb();
    const patch = taskInputToPatch(input);
    const record = await new TaskStore(db, this.now).update(id, patch);

    this.changes.next();
    return taskRecordToTask(record);
  }

  async remove(id: string): Promise<void> {
    const db = this.dbSession.requireDb();
    await new TaskStore(db, this.now).remove(id);
    this.changes.next();
  }

  private async fetchAndSave(db: FeeloDb): Promise<void> {
    let invalidated = false;
    const changed = this.dbSession.db$
      .pipe(
        filter((current) => current !== db),
        take(1),
      )
      .subscribe(() => {
        invalidated = true;
      });
    const guard = () => {
      if (invalidated || !this.dbSession.isCurrent(db) || !db.isOpen())
        throw new Error('Сессия пользовательской БД изменилась');
    };
    try {
      const response = await firstValueFrom(
        this.api
          .get()
          .pipe(takeUntil(this.dbSession.db$.pipe(filter((current) => current !== db)))),
      );
      if (invalidated || !this.dbSession.isCurrent(db)) return;
      const snapshot = taskSnapshotFor(response, db.userId);
      await new TaskStore(db, this.now).upsertSynced(snapshot.records, guard, snapshot.seenIds);
    } catch (error) {
      if (invalidated || !this.dbSession.isCurrent(db)) return;
      throw error;
    } finally {
      changed.unsubscribe();
    }
  }
}
