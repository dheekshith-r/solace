import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { haptics } from '../theme/haptics';
import { spring } from '../theme/motion';
import { colors, kit, radius, spacing, tabBarHeight, type as typeScale, type Palette } from '../theme/tokens';
import { PressScale } from './PressScale';
import { testId } from './testId';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export type Tab = { key: string; label: string };
type Slot = { x: number; width: number };

const PAD = spacing.xs + spacing.xs / 2;
const GAP = spacing.xs;
const PILL = tabBarHeight - PAD * 2;
const MIDDLE_BASE = 100; // The pill's middle is a 100-wide bar scaled to length, so only transforms animate.

/**
 * Where the lit pill sits for a (possibly fractional) tab position, between measured tab slots.
 * Clamped to the first and last tab, so the spring never pushes it past the bar's rounded ends.
 */
export function pillGeometry(position: number, slots: readonly Slot[]): Slot {
  'worklet';
  const last = slots.length - 1;
  if (last < 0) return { x: 0, width: 0 };
  const p = Math.min(Math.max(position, 0), last);
  const i = Math.floor(p);
  const j = Math.min(i + 1, last);
  const f = p - i;
  const a = slots[i] as Slot;
  const b = slots[j] as Slot;
  return { x: a.x + (b.x - a.x) * f, width: a.width + (b.width - a.width) * f };
}

function TabLabel({ label, index, position, palette, onLayout }: { label: string; index: number; position: SharedValue<number>; palette: Palette; onLayout?: (e: LayoutChangeEvent) => void }) {
  // The label turns to onAccent as the pill arrives, so text and pill move as one.
  const lit = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(position.get() - index), [0, 1], [1, 0], Extrapolation.CLAMP),
  }));
  const unlit = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(position.get() - index), [0, 1], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <View style={styles.tab} onLayout={onLayout}>
      <Animated.View style={unlit}>
        <Text variant="calloutStrong" style={{ color: palette.muted }} maxFontSizeMultiplier={typeScale.maxScale}>
          {label}
        </Text>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, lit]}>
        <Text variant="calloutStrong" style={{ color: palette.onAccent }} maxFontSizeMultiplier={typeScale.maxScale}>
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

function Pill({ geometry, color }: { geometry: SharedValue<Slot>; color: string }) {
  const left = useAnimatedStyle(() => ({ transform: [{ translateX: geometry.get().x }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ translateX: geometry.get().x + geometry.get().width - PILL }] }));
  const middle = useAnimatedStyle(() => ({
    transform: [{ translateX: geometry.get().x + PILL / 2 }, { scaleX: Math.max(0, geometry.get().width - PILL) / MIDDLE_BASE }],
  }));
  return (
    <>
      <Animated.View style={[styles.cap, { backgroundColor: color }, left]} />
      <Animated.View style={[styles.middle, { backgroundColor: color }, middle]} />
      <Animated.View style={[styles.cap, { backgroundColor: color }, right]} />
    </>
  );
}

function BarFace({ tabs, position, geometry, palette, shadowInk, measured, onTabLayout }: {
  tabs: readonly Tab[];
  position: SharedValue<number>;
  geometry: SharedValue<Slot>;
  palette: Palette;
  shadowInk: string;
  measured: boolean;
  onTabLayout?: (index: number, e: LayoutChangeEvent) => void;
}) {
  return (
    <View
      style={[styles.bar, styles.shadow, { backgroundColor: palette.tint, shadowColor: shadowInk }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {measured ? <Pill geometry={geometry} color={palette.accent} /> : null}
      {tabs.map((tab, index) => (
        <TabLabel
          key={tab.key}
          label={tab.label}
          index={index}
          position={position}
          palette={palette}
          onLayout={onTabLayout ? (e) => onTabLayout(index, e) : undefined}
        />
      ))}
    </View>
  );
}

/**
 * The floating tab bar. Each tab is as wide as its label; the lit pill slides and stretches between
 * them on the shared spring, with a selection tick. Pass `darkness` (0 light, 1 dark) to let a screen
 * drive the bar's scheme, as Today does with its sky; otherwise it follows the theme.
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
  const slots = useSharedValue<Slot[]>(tabs.map(() => ({ x: 0, width: 0 })));
  const [measured, setMeasured] = useState(false);
  const geometry = useDerivedValue(() => pillGeometry(position.get(), slots.get()));

  useEffect(() => {
    position.set(withSpring(index, spring));
  }, [index, position]);

  // Measurements arrive one tab at a time. They're collected on the JS side first: reading the shared
  // value back here can return a stale copy, which would drop earlier tabs.
  const measuredSlots = useRef<Slot[]>(tabs.map(() => ({ x: 0, width: 0 })));
  const onTabLayout = useCallback(
    (i: number, e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      measuredSlots.current[i] = { x, width };
      const all = measuredSlots.current.map((s) => ({ ...s }));
      slots.set(all);
      if (all.every((s) => s.width > 0)) setMeasured(true);
    },
    [slots],
  );

  const lightFace = useAnimatedStyle(() => ({ opacity: darkness ? 1 - darkness.get() : 1 }));
  const darkFace = useAnimatedStyle(() => ({ opacity: darkness ? darkness.get() : 0 }));
  // Off Today the shadow is always dark ink: a white glow under a dark bar looks cheap.
  const plainShadow = colors.light.ink;

  return (
    <View style={[styles.holder, { bottom }]} pointerEvents="box-none">
      {darkness ? (
        <View>
          <Animated.View style={lightFace}>
            <BarFace tabs={tabs} position={position} geometry={geometry} palette={colors.light} shadowInk={colors.light.ink} measured={measured} onTabLayout={onTabLayout} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, darkFace]} pointerEvents="none">
            {/* Today's dark bar keeps its original soft light glow. */}
            <BarFace tabs={tabs} position={position} geometry={geometry} palette={colors.dark} shadowInk={colors.dark.ink} measured={measured} />
          </Animated.View>
        </View>
      ) : (
        <BarFace tabs={tabs} position={position} geometry={geometry} palette={palette} shadowInk={plainShadow} measured={measured} onTabLayout={onTabLayout} />
      )}
      <View style={[StyleSheet.absoluteFill, styles.touches]} accessibilityRole="tablist">
        {tabs.map((tab, i) => (
          <PressScale
            key={tab.key}
            outerStyle={styles.touch}
            style={styles.touchFill}
            onPress={() => {
              if (i === index) return;
              haptics.selection();
              onSelect(i);
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            testID={testId('tab', tab.label)}
            accessibilityState={{ selected: i === index }}
          >
            {/* Invisible copy of the label, so each touch area is exactly as wide as its tab. */}
            <Text variant="calloutStrong" style={styles.ghost} maxFontSizeMultiplier={typeScale.maxScale}>
              {tab.label}
            </Text>
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
    elevation: kit.elevation,
    shadowOpacity: kit.shadowOpacity,
    shadowRadius: spacing.lg,
    shadowOffset: { width: 0, height: spacing.sm },
  },
  cap: { position: 'absolute', left: 0, top: PAD, width: PILL, height: PILL, borderRadius: radius.full },
  middle: { position: 'absolute', left: 0, top: PAD, width: MIDDLE_BASE, height: PILL, transformOrigin: 'left' },
  tab: { paddingHorizontal: spacing.xxl, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  touches: { flexDirection: 'row', padding: PAD, gap: GAP },
  touch: { alignSelf: 'stretch' },
  touchFill: { flex: 1, paddingHorizontal: spacing.xxl, alignItems: 'center', justifyContent: 'center' },
  ghost: { opacity: 0 },
});
