import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { openUserDb, type FeeloDb } from './db';

@Injectable({ providedIn: 'root' })
/**Активное соединение с IndexDB */
export class DatabaseSessionService {
  private readonly currentDb = new BehaviorSubject<FeeloDb | null>(null);

  private connectGeneration = 0;

  //ограничение для внешних сервисов менять db через next
  readonly db$ = this.currentDb.asObservable();

  async open(userId: string): Promise<void> {
    console.log(userId);
    const generation = ++this.connectGeneration;

    this.releaseCurrentDb();

    const db = await openUserDb(userId);

    // За время открытия пользователь мог выйти или сменить аккаунт.
    if (generation !== this.connectGeneration) {
      db.close({ disableAutoOpen: true });

      throw new DOMException('Сессия изменилась во время открытия БД', 'AbortError');
    }

    this.currentDb.next(db);
  }

  requireDb(): FeeloDb {
    const db = this.currentDb.value;

    if (!db) {
      throw new Error('База текущего пользователя ещё не открыта');
    }

    return db;
  }

  isCurrent(db: FeeloDb): boolean {
    return this.currentDb.value === db;
  }

  close(): void {
    ++this.connectGeneration;
    this.releaseCurrentDb();
  }

  private releaseCurrentDb(): void {
    const previous = this.currentDb.value;

    // Подписчики сразу перестают использовать прежнюю БД.
    this.currentDb.next(null);

    previous?.close({ disableAutoOpen: true });
  }
}
