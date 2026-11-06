import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, easing } from '../theme/motion';
import { kit, opacity, radius, spacing } from '../theme/tokens';
import { useTheme } from './ThemeProvider';

function Dash({ lit }: { lit: boolean }) {
  const { palette } = useTheme();
  const on = useSharedValue(lit ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(lit ? 1 : 0, { duration: duration.quick, easing }));
  }, [lit, on]);
  const fill = useAnimatedStyle(() => ({ opacity: on.get() }));
  return (
    <View style={[styles.dash, { backgroundColor: palette.ink, opacity: opacity.disabled / 2 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.round, { backgroundColor: palette.ink }, fill]} />
    </View>
  );
}

/** Segmented progress: one dash per step; steps up to the current one are lit. */
export function ProgressDashes({ count, current }: { count: number; current: number }) {
  return (
    <View style={styles.row} accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${current + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <Dash key={i} lit={i <= current} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs + spacing.xs / 2 },
  dash: { width: kit.dashWidth, height: kit.dashHeight, borderRadius: radius.full, overflow: 'hidden' },
  round: { borderRadius: radius.full },
});
