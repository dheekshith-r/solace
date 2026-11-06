import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { duration, easing } from '../theme/motion';
import { fontSize, kit, opacity, radius, spacing } from '../theme/tokens';
import { Raised, useFill } from './ThemeProvider';

/** A placeholder block that breathes gently in opacity. Still when reduce motion is on. */
export function SkeletonBlock({ width = '100%', height = fontSize.callout, round = radius.petal / 2 }: { width?: DimensionValue; height?: number; round?: number }) {
  const fill = useFill();
  const reduced = useReducedMotion();
  const level = useSharedValue<number>(opacity.skeletonHigh);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(level);
      level.set(opacity.skeletonHigh);
      return;
    }
    level.set(withRepeat(withTiming(opacity.skeletonLow, { duration: duration.pulse, easing }), -1, true));
  }, [level, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: level.get() }));
  return <Animated.View style={[{ width, height, borderRadius: round, backgroundColor: fill }, style]} />;
}

/** A row-shaped placeholder, matching ListRow: icon, a line and a shorter line. */
export function SkeletonRow() {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SkeletonBlock width={kit.icon + spacing.md} height={kit.icon + spacing.md} round={radius.field - spacing.xs} />
      <View style={styles.lines}>
        <SkeletonBlock width="70%" />
        <SkeletonBlock width="45%" height={fontSize.footnote} />
      </View>
    </View>
  );
}

/** A card-shaped placeholder. Announces loading once to screen readers. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const fill = useFill();
  return (
    <View style={[styles.card, { backgroundColor: fill }]} accessible accessibilityLabel="Loading">
      <Raised>
      <SkeletonBlock width="40%" height={fontSize.heading} />
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
      </Raised>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  lines: { flex: 1, gap: spacing.sm },
  card: { borderRadius: radius.card, padding: spacing.xl, gap: spacing.md },
});
