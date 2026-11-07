import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptics } from '../theme/haptics';
import { spring } from '../theme/motion';
import { kit, radius, spacing, touchTarget } from '../theme/tokens';
import { PressScale } from './PressScale';
import { testId } from './testId';
import { Text } from './Text';
import { useFill, useTheme } from './ThemeProvider';

/** Selectable chip. Selection fully inverts to the accent, fading in rather than snapping. */
export function Chip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  const fill = useFill();
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(selected ? 1 : 0, spring));
  }, [on, selected]);
  const onStyle = useAnimatedStyle(() => ({ opacity: on.get() }));
  const offText = useAnimatedStyle(() => ({ opacity: 1 - on.get() }));

  return (
    <PressScale
      onPress={() => {
        if (!selected) haptics.selection();
        onPress();
      }}
      hitSlop={(touchTarget - kit.chipHeight) / 2}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testId('chip', label)}
      accessibilityState={{ selected }}
      outerStyle={styles.hug}
      style={[styles.chip, { backgroundColor: fill }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: palette.accent }, onStyle]} />
      <View>
        <Animated.View style={offText}>
          <Text variant="footnoteStrong">{label}</Text>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, onStyle]}>
          <Text variant="footnoteStrong" tone="onAccent">
            {label}
          </Text>
        </Animated.View>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: kit.chipHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { ...StyleSheet.absoluteFill, borderRadius: radius.chip },
  hug: { alignSelf: 'flex-start' },
});
