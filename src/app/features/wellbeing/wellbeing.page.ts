import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { CircadianService } from '@api/services/circadian.service';
import { ProfileService } from '@api/services/profile.service';
import { CircadianCurveDto } from '@api/models/circadian-curve-dto';
import { EnergyCurveKind } from '@api/models/energy-curve-kind';
import { ProfileDto } from '@api/models/profile-dto';
import { curvePath, dayPoints, localDate, sleepSegments } from './rhythm-chart';

const CHARTS: { kind: EnergyCurveKind; title: string; color: string }[] = [
  { kind: 'General', title: 'Общий график активности', color: '#6b8270' },
  { kind: 'Social', title: 'Социальный график активности', color: '#c7ef8d' },
  { kind: 'Physical', title: 'Физический график активности', color: '#ffda70' },
  { kind: 'Mental', title: 'Умственный график активности', color: '#97dafe' },
  { kind: 'Routine', title: 'Рутинный график активности', color: '#eeb0a6' },
];

@Component({
  selector: 'app-wellbeing-page',
  imports: [RouterLink],
  templateUrl: './wellbeing.page.html',
  styleUrl: './wellbeing.page.scss',
})
export class WellbeingPage {
  private readonly circadian = inject(CircadianService);
  private readonly profiles = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);
  readonly date = localDate(new Date());
  readonly pending = signal(false);
  readonly error = signal('');
  readonly profileError = signal(false);
  readonly profile = signal<ProfileDto | null>(null);
  readonly curves = signal<CircadianCurveDto[]>([]);
  readonly ticks = [6, 12, 18, 24];
  readonly wakeTime = computed(
    () =>
      this.profile()?.planningSettings?.requiredWakeTime ??
      this.profile()?.sleepProfile?.requiredWakeTime,
  );
  readonly sleep = computed(() => {
    const day = new Date(`${this.date}T12:00:00`).getDay();
    const profile = this.profile()?.sleepProfile;
    return sleepSegments(day === 0 || day === 6 ? profile?.freeDays : profile?.workDays);
  });
  readonly charts = computed(() => {
    const groups = CHARTS.map((chart) => ({
      ...chart,
      data: dayPoints(
        this.curves().find((curve) => curve.kind === chart.kind) ?? {
          kind: chart.kind,
          points: [],
          windows: [],
        },
        this.date,
      ),
    }));
    const energies = groups.flatMap((group) => group.data.map((point) => point.energy));
    const min = Math.min(...energies),
      max = Math.max(...energies);
    const range = max - min || 1;
    return groups.map((group) => {
      const points = group.data.map((point) => ({
        x: 26 + point.time * 288,
        y: max === min ? 66 : 112 - ((point.energy - min) / range) * 98,
        label: `${Math.floor(point.time * 24)
          .toString()
          .padStart(2, '0')}:${Math.round((point.time * 1440) % 60)
          .toString()
          .padStart(2, '0')} — ${point.energy.toFixed(2)}`,
      }));
      const markers = points.filter((point) =>
        this.ticks.some((hour) => Math.abs(point.x - (26 + (hour / 24) * 288)) < 0.01),
      );
      return {
        ...group,
        points,
        markers: points.length === 1 ? points : markers,
        path: curvePath(points),
      };
    });
  });

  constructor() {
    this.load();
  }

  load(): void {
    if (this.pending()) return;
    this.pending.set(true);
    this.error.set('');
    this.profileError.set(false);
    forkJoin({
      curves: this.circadian.get({ date: this.date }),
      profile: this.profiles.get().pipe(
        catchError(() => {
          this.profileError.set(true);
          return of(null);
        }),
      ),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: ({ curves, profile }) => {
          this.curves.set(curves);
          this.profile.set(profile);
        },
        error: () =>
          this.error.set('Не удалось загрузить ритм. Проверьте подключение и попробуйте снова.'),
      });
  }

  clock(value: string | undefined | null): string {
    return value?.slice(0, 5) || '—';
  }
}
