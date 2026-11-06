// Splash (spec 8.1): Sola fades in with the tagline on the same background as the native splash,
// while the API wakes in parallel. Hands off within 2.5 s. Ticket 05 adds the session refresh here.
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Entrance, Text, useTheme } from '../src/components';
import { useOnboarding } from '../src/features/onboarding/store';
import { SolaFigure } from '../src/features/sola/Sola';
import { fetchHealth } from '../src/lib/api';
import { kit, spacing } from '../src/theme/tokens';

const SPLASH_MAX_MS = 2500;
const SPLASH_MIN_MS = 1400; // Long enough for Sola and the tagline to land.

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
    const started = Date.now();
    // Wake Render in the background; the splash never waits on it beyond its own maximum.
    const wake = fetchHealth().catch(() => undefined);
    const leave = () => {
      if (left) return;
      left = true;
      router.replace(onboarded ? '/today' : '/onboarding');
    };
    const minWait = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS));
    void Promise.all([wake, minWait]).then(leave);
    const cap = setTimeout(leave, SPLASH_MAX_MS - (Date.now() - started));
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
