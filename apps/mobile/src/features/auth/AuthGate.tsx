import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from './session';

// Reachable signed out; kit-* are the design-kit screens used for screenshots.
const PUBLIC = ['/', '/onboarding', '/sign-up', '/log-in'];
const isPublic = (path: string) => PUBLIC.includes(path) || path.startsWith('/kit');

export const needsSignIn = (path: string, signedIn: boolean) => !signedIn && !isPublic(path);

/** Only an in-app path that needs an account; anything else (other hosts, public pages) is dropped. */
export function safeNext(next: unknown): Href | null {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || isPublic(next)) return null;
  return next as Href;
}

/** A solace:// link to a signed-in screen while signed out goes to log-in, then on to that screen. */
export function AuthGate() {
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = useSession((s) => Boolean(s.user));
  useEffect(() => {
    if (needsSignIn(pathname, signedIn)) router.replace({ pathname: '/log-in', params: { next: pathname } });
  }, [pathname, signedIn, router]);
  return null;
}
