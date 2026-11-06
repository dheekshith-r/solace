import { resolveScheme } from '../../appearance';
import { constellation, localDay, moodTrend } from '../data';

const at = (iso: string, mood = 3) => ({ id: iso, mood, note: null, source: 'home' as const, createdAt: iso });

describe('You tab', () => {
  const now = new Date('2026-11-06T12:00:00Z');

  it('puts a star on the local day, in the user time zone', () => {
    // 20:00 UTC on Nov 5 is already Nov 6 in Kolkata.
    expect(localDay('2026-11-05T20:00:00Z', 'Asia/Kolkata')).toBe('2026-11-06');
    const days = constellation([at('2026-11-05T20:00:00Z'), at('2026-11-04T06:00:00Z')], 'Asia/Kolkata', now);
    expect(days).toHaveLength(35);
    expect(days.filter((d) => d.lit).map((d) => d.day)).toEqual(['2026-11-04', '2026-11-06']);
  });

  it('averages each day and leaves gaps for days without a check-in', () => {
    const trend = moodTrend([at('2026-11-06T09:00:00Z', 2), at('2026-11-06T10:00:00Z', 4), at('2026-11-04T09:00:00Z', 5)], 'UTC', now);
    expect(trend).toHaveLength(14);
    expect(trend.slice(-3)).toEqual([5, null, 3]);
  });

  it('resolves Appearance for every option', () => {
    expect(resolveScheme('light', 'dark', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light', 'light')).toBe('dark');
    expect(resolveScheme('system', 'dark', 'light')).toBe('dark');
    expect(resolveScheme('sky', 'light', 'dark')).toBe('dark');
  });
});