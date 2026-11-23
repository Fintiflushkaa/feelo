import { inject, Injectable } from '@angular/core';
import {
  filter,
  firstValueFrom,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  takeUntil,
  type Observable,
} from 'rxjs';

import { TasksService } from '@api/services/tasks.service';
import { DatabaseSessionService } from '@core/storage/database-session.service';
import type { FeeloDb } from '@core/storage/db';
import { TaskStore } from '@core/storage/task.storage';
import { createTaskData, taskDtoToRecord, taskInputToPatch, taskRecordToTask } from './task.mapper';
import type { CreateTaskInput, Task, UpdateTaskInput } from './task.model';

@Injectable({ providedIn: 'root' })
export class TaskRepositoryService {
  private readonly api = inject(TasksService);
  private readonly dbSession = inject(DatabaseSessionService);

  private readonly workRequests = new WeakMap<FeeloDb, Promise<void>>();

  readonly tasks$: Observable<readonly Task[]> = this.dbSession.db$.pipe(
    switchMap((db) => {
      if (!db) {
        return of<readonly Task[]>([]);
      }

      return from(new TaskStore(db).observeActive()).pipe(
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
    const data = createTaskData(crypto.randomUUID(), input);
    const record = await new TaskStore(db).create(data);

    return taskRecordToTask(record);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const db = this.dbSession.requireDb();
    const patch = taskInputToPatch(input);
    const record = await new TaskStore(db).update(id, patch);

    return taskRecordToTask(record);
  }

  async remove(id: string): Promise<void> {
    const db = this.dbSession.requireDb();
    await new TaskStore(db).remove(id);
  }

  private async fetchAndSave(db: FeeloDb): Promise<void> {
    try {
      const dbChanged$ = this.dbSession.db$.pipe(filter((current) => current !== db));

      const dtos = await firstValueFrom(this.api.get().pipe(takeUntil(dbChanged$)));

      if (!this.dbSession.isCurrent(db)) {
        return;
      }

      await new TaskStore(db).upsertSynced(dtos.map(taskDtoToRecord));
    } catch (error) {
      if (!this.dbSession.isCurrent(db)) {
        return;
      }

      throw error;
    }
  }
}
