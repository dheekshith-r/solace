import { listCheckinsResponseSchema, meResponseSchema, type Checkin } from '@solace/shared';
import { useQuery } from '@tanstack/react-query';
import { authed, useSession } from '../auth/session';

export const ME_KEY = ['me'] as const;
// About six months, so the calendar can page back five months.
export const CALENDAR_DAYS = 186;
export const CALENDAR_MONTHS_BACK = 5;
export const CHECKINS_KEY = ['checkins', CALENDAR_DAYS] as const;
export const TREND_DAYS = 14;

export function useMe() {
  const signedIn = useSession((s) => Boolean(s.user));
  return useQuery({ queryKey: ME_KEY, queryFn: () => authed('/me', { schema: meResponseSchema }), enabled: signedIn });
}

export function useCheckins() {
  const signedIn = useSession((s) => Boolean(s.user));
  return useQuery({ queryKey: CHECKINS_KEY, queryFn: () => authed(`/checkins?days=${CALENDAR_DAYS}`, { schema: listCheckinsResponseSchema }), enabled: signedIn });
}

/** YYYY-MM-DD for an instant, in a time zone (the user's), so a star lands on the day they lived it. */
export function localDay(iso: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The last `count` local days, oldest first, ending today. */
export function lastDays(count: number, timeZone: string, now = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => localDay(new Date(now.getTime() - (count - 1 - i) * 86_400_000), timeZone));
}

/** Local days with at least one check-in, for the calendar. */
export function activeDays(checkins: Checkin[], timeZone: string): Set<string> {
  return new Set(checkins.map((c) => localDay(c.createdAt, timeZone)));
}

/** Average mood per day over the last two weeks; null where there was no check-in. */
export function moodTrend(checkins: Checkin[], timeZone: string, now = new Date()): (number | null)[] {
  const byDay = new Map<string, number[]>();
  for (const c of checkins) {
    const day = localDay(c.createdAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), c.mood]);
  }
  return lastDays(TREND_DAYS, timeZone, now).map((day) => {
    const moods = byDay.get(day);
    return moods?.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  });
}
