// Launch: Android's native splash (Sola on the night navy) stays up while this restores the session,
// then fades straight into the first screen. Signed in goes to Today (from cache if offline);
// otherwise onboarding, or sign-up if onboarding is done. Never more than 2.5 s.
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { hasStoredSession, loadMe, refreshSession, useSession } from '../src/features/auth/session';
import { useOnboarding } from '../src/features/onboarding/store';
import { fetchHealth } from '../src/lib/api';
import { ApiError } from '../src/lib/http';
import { brand } from '../src/theme/tokens';

const SPLASH_MAX_MS = 2500;

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

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export default function Launch() {
  const router = useRouter();
  const onboarded = useOnboarding((s) => s.done);

  useEffect(() => {
    let left = false;
    void fetchHealth().catch(() => undefined); // Wake Render early, whatever happens next.
    const go = async (to: Destination) => {
      if (left) return;
      left = true;
      router.replace(to);
      // Two frames: the destination has drawn before the native splash fades off it.
      await nextFrame();
      await nextFrame();
      void SplashScreen.hideAsync();
    };
    void decide(onboarded).then(go);
    const cap = setTimeout(() => void go(useSession.getState().user ? '/today' : onboarded ? '/sign-up' : '/onboarding'), SPLASH_MAX_MS);
    return () => {
      left = true;
      clearTimeout(cap);
    };
  }, [onboarded, router]);

  // The splash's own navy, under the native splash: if anything shows early, it's the same color.
  return <View style={styles.screen} />;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: brand.night } });
