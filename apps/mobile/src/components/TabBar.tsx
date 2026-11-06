import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { haptics } from '../theme/haptics';
import { spring } from '../theme/motion';
import { colors, kit, radius, spacing, tabBarHeight, type Palette } from '../theme/tokens';
import { PressScale } from './PressScale';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export type Tab = { key: string; label: string };

const PAD = spacing.xs + spacing.xs / 2;
const GAP = spacing.xs;

/** Where the lit pill sits for a tab. Pure, so it's testable. */
export function pillOffset(index: number): number {
  'worklet';
  return index * (kit.tabWidth + GAP);
}

function TabLabel({ label, index, position, palette }: { label: string; index: number; position: SharedValue<number>; palette: Palette }) {
  // The label turns to onAccent as the pill arrives, so text and pill move as one.
  const lit = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(position.get() - index), [0, 1], [1, 0], Extrapolation.CLAMP),
  }));
  const unlit = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(position.get() - index), [0, 1], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <View style={styles.tab}>
      <Animated.View style={unlit}>
        <Text variant="calloutStrong" style={{ color: palette.muted }} maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, lit]}>
        <Text variant="calloutStrong" style={{ color: palette.onAccent }} maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

function BarFace({ tabs, position, palette, shadow }: { tabs: readonly Tab[]; position: SharedValue<number>; palette: Palette; shadow: boolean }) {
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: pillOffset(position.get()) }] }));
  return (
    <View style={[styles.bar, { backgroundColor: palette.tint }, shadow ? [styles.shadow, { shadowColor: palette.ink }] : null]}>
      <Animated.View style={[styles.pill, { backgroundColor: palette.accent }, pill]} />
      {tabs.map((tab, index) => (
        <TabLabel key={tab.key} label={tab.label} index={index} position={position} palette={palette} />
      ))}
    </View>
  );
}

/**
 * The floating tab bar. The lit pill slides between tabs on the shared spring, with a selection
 * tick. Pass `darkness` (0 light, 1 dark) to let a screen drive the bar's scheme, as Today does
 * with its sky; otherwise it follows the theme.
 */
export function TabBar({
  tabs,
  index,
  onSelect,
  bottom,
  darkness,
}: {
  tabs: readonly Tab[];
  index: number;
  onSelect: (index: number) => void;
  bottom: number;
  darkness?: SharedValue<number>;
}) {
  const { palette } = useTheme();
  const position = useSharedValue(index);
  useEffect(() => {
    position.set(withSpring(index, spring));
  }, [index, position]);
  const darkFace = useAnimatedStyle(() => ({ opacity: darkness ? darkness.get() : 0 }));

  return (
    <View style={[styles.holder, { bottom }]} pointerEvents="box-none">
      {darkness ? (
        <View>
          <BarFace tabs={tabs} position={position} palette={colors.light} shadow />
          <Animated.View style={[StyleSheet.absoluteFill, darkFace]} pointerEvents="none">
            <BarFace tabs={tabs} position={position} palette={colors.dark} shadow={false} />
          </Animated.View>
        </View>
      ) : (
        <BarFace tabs={tabs} position={position} palette={palette} shadow />
      )}
      <View style={[StyleSheet.absoluteFill, styles.touches]} accessibilityRole="tablist">
        {tabs.map((tab, i) => (
          <PressScale
            key={tab.key}
            style={styles.tab}
            onPress={() => {
              if (i === index) return;
              haptics.selection();
              onSelect(i);
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: i === index }}
          >
            <View />
          </PressScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  holder: { position: 'absolute', alignSelf: 'center' },
  bar: {
    flexDirection: 'row',
    height: tabBarHeight,
    padding: PAD,
    gap: GAP,
    borderRadius: radius.full,
  },
  shadow: {
    elevation: 10,
    shadowOpacity: kit.shadowOpacity,
    shadowRadius: spacing.lg,
    shadowOffset: { width: 0, height: spacing.sm },
  },
  pill: { position: 'absolute', top: PAD, left: PAD, bottom: PAD, width: kit.tabWidth, borderRadius: radius.full },
  tab: { width: kit.tabWidth, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  touches: { flexDirection: 'row', padding: PAD, gap: GAP },
});
