import { checkinResponseSchema, todayResponseSchema, type Suggestion, type TodayResponse } from '@solace/shared';
import { useQuery } from '@tanstack/react-query';
import { withQuietRetry } from '../../lib/http';
import { queryClient } from '../../lib/queryClient';
import { storage } from '../../lib/storage';
import { authed, useSession } from '../auth/session';

export const TODAY_KEY = ['today'] as const;
const PENDING_MOOD_KEY = 'pendingMood';
const SAVE_DELAY_MS = 1500; // Taps in quick succession: the last one wins (decision 4).

/** `/today` for the signed-in user, cached on the phone so Today never waits on the network. */
export function useToday() {
  const signedIn = useSession((s) => Boolean(s.user));
  return useQuery({
    queryKey: TODAY_KEY,
    queryFn: () => authed('/today', { schema: todayResponseSchema }),
    enabled: signedIn,
  });
}

function setSuggestion(suggestion: Suggestion) {
  queryClient.setQueryData<TodayResponse>(TODAY_KEY, (old) => (old ? { ...old, suggestion } : old));
}

let timer: ReturnType<typeof setTimeout> | undefined;
let sending = false;

/** Sends the pending mood, if any. Offline, it keeps trying quietly; the mood stays saved on the phone meanwhile. */
export async function flushPendingMood(): Promise<void> {
  const pending = storage.getString(PENDING_MOOD_KEY);
  if (!pending || sending || !useSession.getState().user) return;
  sending = true;
  try {
    const mood = Number(pending);
    const result = await withQuietRetry(() => authed('/checkins', { method: 'POST', body: { mood, source: 'home' }, schema: checkinResponseSchema }));
    // Only clear it if no newer tap arrived while this one was in flight.
    if (storage.getString(PENDING_MOOD_KEY) === pending) storage.remove(PENDING_MOOD_KEY);
    setSuggestion(result.suggestion);
  } catch {
    // Still offline after the quiet retries: it stays pending and goes with the next tap or launch.
  } finally {
    sending = false;
  }
  if (storage.getString(PENDING_MOOD_KEY) && storage.getString(PENDING_MOOD_KEY) !== pending) void flushPendingMood();
}

/** A mood tap on Today: remembered at once, sent 1.5 s after the last tap. */
export function queueMood(mood: number) {
  storage.set(PENDING_MOOD_KEY, String(mood));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushPendingMood(), SAVE_DELAY_MS);
}

/** The words on Today's suggestion button for each action. */
export const actionLabel: Record<Suggestion['action'], string> = {
  breathe: 'Breathe',
  reflect: 'Reflect',
  affirmation: 'Read',
  none: 'Breathe',
};
