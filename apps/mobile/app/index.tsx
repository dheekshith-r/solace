import { BlurMask, Canvas, Circle } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { fetchHealth } from '../src/lib/api';
import { duration, easing } from '../src/theme/motion';
import { colors, fontSize, screenPadding, spacing } from '../src/theme/tokens';

// Phase 0 check screen, replaced in Phase 1. It proves four things on a real phone:
// the dev build runs, the API and database answer, Skia draws, and Reanimated runs in Bundle Mode.

const GLOW_SIZE = 160;
const GLOW_BLUR = 24;
const GLOW_SCALE_TO = 1.12;

type HealthState = { kind: 'checking' } | { kind: 'ok'; ms: number } | { kind: 'error'; message: string };

async function checkHealth(): Promise<HealthState> {
  const startedAt = Date.now();
  try {
    await fetchHealth();
    return { kind: 'ok', ms: Date.now() - startedAt };
  } catch (error) {
    return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

export default function PhaseZeroCheck() {
  const palette = colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [health, setHealth] = useState<HealthState>({ kind: 'checking' });

  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withTiming(GLOW_SCALE_TO, { duration: duration.breathe, easing }), -1, true);
  }, [scale]);
  const glowStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void checkHealth().then((result) => {
      if (!cancelled) setHealth(result);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setHealth({ kind: 'checking' });
    setAttempt((current) => current + 1);
  };

  const label =
    health.kind === 'checking'
      ? 'Reaching the API. This can take a minute if it was asleep.'
      : health.kind === 'ok'
        ? `API and database OK (${health.ms} ms)`
        : `Failed: ${health.message}`;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Animated.View style={[styles.glow, glowStyle]}>
        <Canvas style={styles.glow}>
          <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2 - GLOW_BLUR} color={palette.mascot}>
            <BlurMask blur={GLOW_BLUR} style="normal" />
          </Circle>
        </Canvas>
      </Animated.View>

      <Text style={[styles.title, { color: palette.ink }]}>Solace</Text>
      <Text style={[styles.status, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.status, { color: palette.muted }]}>{process.env.EXPO_PUBLIC_API_URL}</Text>

      <Pressable onPress={retry} hitSlop={spacing.md}>
        <Text style={[styles.retry, { color: palette.accent }]}>Check again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: screenPadding,
  },
  glow: { width: GLOW_SIZE, height: GLOW_SIZE },
  title: { fontSize: fontSize.largeTitle, fontWeight: '700' },
  status: { fontSize: fontSize.callout, textAlign: 'center' },
  retry: { fontSize: fontSize.body, fontWeight: '600', paddingTop: spacing.sm },
});
