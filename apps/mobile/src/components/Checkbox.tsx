import { Check } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from '../theme/motion';
import { kit, radius, spacing, touchTarget } from '../theme/tokens';
import { PressScale } from './PressScale';
import { testId } from './testId';
import { useFill, useTheme } from './ThemeProvider';

/** A labelled checkbox. The box fills with the accent and the tick fades in; the whole row is the touch target. */
export function Checkbox({ checked, onChange, label, accessibilityLabel }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; accessibilityLabel: string }) {
  const { palette } = useTheme();
  const fill = useFill();
  const on = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(checked ? 1 : 0, spring));
  }, [checked, on]);
  const filled = useAnimatedStyle(() => ({ opacity: on.get(), transform: [{ scale: kit.checkFrom + (1 - kit.checkFrom) * on.get() }] }));

  return (
    <PressScale
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      testID={testId('checkbox', accessibilityLabel)}
      accessibilityState={{ checked }}
      outerStyle={styles.outer}
      style={styles.row}
    >
      <View style={[styles.box, { backgroundColor: fill, borderColor: palette.separator }]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, styles.round, { backgroundColor: palette.accent }, filled]}>
          <Check size={kit.iconSmall - spacing.xs} color={palette.onAccent} strokeWidth={kit.iconStrokeBold + 1} />
        </Animated.View>
      </View>
      <View style={styles.label}>{label}</View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget },
  box: { width: kit.checkbox, height: kit.checkbox, borderRadius: radius.petal / 2, borderWidth: kit.focusBorder, overflow: 'hidden' },
  round: { borderRadius: radius.petal / 2 - kit.focusBorder },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
