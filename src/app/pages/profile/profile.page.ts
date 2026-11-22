import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { UserDto } from '../../../api/models/user-dto';
import { ProfileService } from '../../../api/services/profile.service';
import { TokenStorageService } from '../../core/auth/token-storage.service';

@Component({
  selector: 'app-profile-page',
  imports: [RouterLink],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly tokens = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly profiles = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<UserDto | null>(null);
  readonly pending = signal(false);
  readonly error = signal('');

  constructor() {
    this.loadProfile();
  }

  loadProfile(): void {
    if (this.pending()) return;
    this.pending.set(true);
    this.error.set('');
    this.profiles
      .getProfile()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: (profile) => this.profile.set(profile),
        error: () => this.error.set('Не удалось загрузить профиль. Попробуйте ещё раз.'),
      });
  }

  logout(): void {
    this.tokens.clear();
    void this.router.navigateByUrl('/auth', { replaceUrl: true });
  }
}
