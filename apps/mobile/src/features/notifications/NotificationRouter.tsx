import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
  setNotificationHandler,
  type NotificationResponse,
} from 'expo-notifications';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useSession } from '../auth/session';
import { routeForUrl } from './plan';

// While the app is open, reminders still show as a banner (they are what the user asked for).
setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const routeOf = (response: NotificationResponse | null) => routeForUrl(response?.notification.request.content.data?.url);

/**
 * Opens the screen a tapped reminder points to (spec 2.3): right away while running, and on a cold
 * start only after the splash has restored the session, so the user never lands signed out.
 */
export function NotificationRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = useSession((s) => Boolean(s.user));
  const pending = useRef<ReturnType<typeof routeForUrl>>(null);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    void getLastNotificationResponseAsync().then((response) => {
      const id = response?.notification.request.identifier ?? null;
      if (id && id !== handled.current) {
        handled.current = id;
        pending.current = routeOf(response);
      }
    });
    const sub = addNotificationResponseReceivedListener((response) => {
      handled.current = response.notification.request.identifier;
      pending.current = routeOf(response);
      if (useSession.getState().user && pending.current) {
        router.push(pending.current);
        pending.current = null;
      }
    });
    return () => sub.remove();
  }, [router]);

  // Cold start: once the splash has handed off ("/" is the splash) and someone is signed in.
  useEffect(() => {
    if (pathname === '/' || !signedIn || !pending.current) return;
    const to = pending.current;
    pending.current = null;
    if (to !== pathname) router.push(to);
  }, [pathname, signedIn, router]);

  return null;
}
