import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileService } from '@core/api/services/profile.service';
import { DatabaseSessionService } from '@core/storage/database-session.service';
import { StoragePersistence, requestStoragePersistence } from '@core/storage/storage.durrability';

@Injectable({ providedIn: 'root' })
export class AppDataSessionService {
  private readonly profile = inject(ProfileService);
  private readonly session = inject(DatabaseSessionService);
  readonly persistence = signal<StoragePersistence | null>(null);

  async openCurrentUser(): Promise<void> {
    const profile = await firstValueFrom(this.profile.get());
    await this.session.open(profile.id);
    this.persistence.set(await requestStoragePersistence());
  }
}
