import { curvePath, dayPoints, localDate, sleepSegments } from './rhythm-chart';

describe('Rhythm chart data', () => {
  it('uses the local calendar date for API requests', () => {
    expect(localDate(new Date(2026, 10, 24, 0, 15))).toBe('2026-11-24');
  });

  it('sorts points and removes invalid values and points outside the selected day', () => {
    const points = dayPoints(
      {
        kind: 'General',
        windows: [],
        points: [
          { time: '2026-11-24T12:00:00', energy: 0.9 },
          { time: '2026-11-24T06:00:00', energy: 0.3 },
          { time: '2026-11-23T12:00:00', energy: 0.7 },
          { time: 'invalid', energy: 0.2 },
          { time: '2026-11-24T18:00:00', energy: NaN },
          { time: '2026-11-25T00:00:00', energy: 0.4 },
        ],
      },
      '2026-11-24',
    );
    expect(points.map((point) => point.energy)).toEqual([0.3, 0.9, 0.4]);
    expect(points.at(-1)?.time).toBe(1);
  });

  it('splits overnight sleep across the beginning and end of the day', () => {
    const segments = sleepSegments({ sleepStart: '23:00:00', wakeTime: '07:00:00' });
    expect(segments).toHaveLength(2);
    expect(segments[0].left).toBe(0);
    expect(segments[0].width).toBeCloseTo((7 / 24) * 100);
    expect(segments[1].left + segments[1].width).toBeCloseTo(100);
    expect(sleepSegments({ sleepStart: '14:00:00', wakeTime: '16:00:00' })).toHaveLength(1);
    expect(sleepSegments(undefined)).toEqual([]);
  });

  it('creates finite paths for empty, single-point and flat curves', () => {
    expect(curvePath([])).toBe('');
    expect(curvePath([{ x: 1, y: 2 }])).toBe('M 1 2');
    const path = curvePath([
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
    expect(path).toContain('C');
    expect(path).not.toMatch(/NaN|Infinity/);
  });
});
