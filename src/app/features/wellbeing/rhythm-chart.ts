import { CircadianCurveDto } from '@api/models/circadian-curve-dto';
import { SleepScheduleDto } from '@api/models/sleep-schedule-dto';

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayPoints(curve: CircadianCurveDto, date: string) {
  const start = new Date(`${date}T00:00:00`).getTime();
  const end = new Date(`${date}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const duration = end.getTime() - start;
  const points = new Map<number, number>();
  for (const point of curve.points) {
    const time = new Date(point.time).getTime();
    if (
      Number.isFinite(time) &&
      Number.isFinite(point.energy) &&
      time >= start &&
      time <= end.getTime()
    ) {
      points.set((time - start) / duration, point.energy);
    }
  }
  return [...points].sort(([a], [b]) => a - b).map(([time, energy]) => ({ time, energy }));
}

/** Monotone cubic interpolation avoids introducing peaks absent from the API points. */
export function curvePath(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  const slopes = points.slice(1).map((p, i) => (p.y - points[i].y) / (p.x - points[i].x));
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0] ?? 0;
    if (i === points.length - 1) return slopes[i - 1];
    const a = slopes[i - 1],
      b = slopes[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  return (
    `M ${points[0].x} ${points[0].y}` +
    points
      .slice(1)
      .map((point, i) => {
        const previous = points[i];
        const step = (point.x - previous.x) / 3;
        return ` C ${previous.x + step} ${previous.y + step * tangents[i]}, ${point.x - step} ${point.y - step * tangents[i + 1]}, ${point.x} ${point.y}`;
      })
      .join('')
  );
}

export function sleepSegments(schedule: SleepScheduleDto | undefined) {
  const minutes = (value: string) => {
    const match = /^(\d{2}):(\d{2})/.exec(value);
    if (!match) return NaN;
    const h = Number(match[1]),
      m = Number(match[2]);
    return h < 24 && m < 60 ? h * 60 + m : NaN;
  };
  if (!schedule) return [];
  const start = minutes(schedule.sleepStart),
    end = minutes(schedule.wakeTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return [];
  const ranges =
    start < end
      ? [[start, end]]
      : [
          [0, end],
          [start, 1440],
        ];
  return ranges
    .filter(([a, b]) => b > a)
    .map(([a, b]) => ({ left: a / 14.4, width: (b - a) / 14.4 }));
}
