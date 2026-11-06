// Splash (spec 8.1): Sola fades in with the tagline on the same background as the native splash.
// Meanwhile it restores the session and wakes the API. Hands off within 2.5 s:
// signed in, to Today (from cache if offline); otherwise onboarding, or sign-up if onboarding is done.
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Entrance, Text, useTheme } from '../src/components';
import { hasStoredSession, loadMe, refreshSession, useSession } from '../src/features/auth/session';
import { useOnboarding } from '../src/features/onboarding/store';
import { SolaFigure } from '../src/features/sola/Sola';
import { fetchHealth } from '../src/lib/api';
import { ApiError } from '../src/lib/http';
import { kit, spacing } from '../src/theme/tokens';

const SPLASH_MAX_MS = 2500;
const SPLASH_MIN_MS = 1400; // Long enough for Sola and the tagline to land.

type Destination = '/today' | '/onboarding' | '/sign-up';

/** Where to go: signed in (or a cached user while offline) goes to Today. */
async function decide(onboarded: boolean): Promise<Destination> {
  if (!(await hasStoredSession())) return onboarded ? '/sign-up' : '/onboarding';
  try {
    await refreshSession();
    void loadMe().catch(() => undefined);
    return '/today';
  } catch (error) {
    // Offline or the API still waking: a cached user still gets Today; it refreshes later.
    if (error instanceof ApiError && error.retryable && useSession.getState().user) return '/today';
    return '/onboarding';
  }
}

export default function Splash() {
  const router = useRouter();
  const { palette, scheme } = useTheme();
  const onboarded = useOnboarding((s) => s.done);
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );

  useEffect(() => {
    let left = false;
    void fetchHealth().catch(() => undefined); // Wake Render early, whatever happens next.
    const minWait = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS));
    const go = (to: Destination) => {
      if (left) return;
      left = true;
      router.replace(to);
    };
    const decided = decide(onboarded);
    void Promise.all([decided, minWait]).then(([to]) => go(to));
    // Never hold the splash longer than its maximum: a cached user goes to Today, others to onboarding.
    const cap = setTimeout(() => go(useSession.getState().user ? '/today' : onboarded ? '/sign-up' : '/onboarding'), SPLASH_MAX_MS);
    return () => {
      left = true;
      clearTimeout(cap);
    };
  }, [onboarded, router]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Entrance index={0}>
        <SolaFigure size={kit.heroSola} glow={scheme === 'dark' ? 'night' : 'day'} mood={4} />
      </Entrance>
      <Entrance index={2}>
        <Text variant="heading" center>
          A calm place to land.
        </Text>
      </Entrance>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
});
