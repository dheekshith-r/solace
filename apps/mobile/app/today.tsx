// Today: the mood check-in and suggestion in a sheet, with the scene behind them (spec sections 7.7 and 8). Copy and
// numbers are sample data until Phase 3 connects the API. The m, gust and v params only
// exist for screenshots.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import * as Device from 'expo-device';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { minuteOfDay, wrapMinute } from '../src/features/sky/astro';
import { SkyCanvas, type Gust } from '../src/features/sky/SkyCanvas';
import { skyTextIsWhite } from '../src/features/sky/skyColors';
import { MoodRow, TabBar } from '../src/features/today/parts';
import { duration, easing, spring } from '../src/theme/motion';
import { demoMinutes, moodNeutral, skyMotion, skyTimes, sola, wind } from '../src/theme/sky';
import {
  colors,
  font,
  fontSize,
  lineHeightRatio,
  radius,
  screenPadding,
  spacing,
  tabBarHeight,
  today,
  type Palette,
} from '../src/theme/tokens';

const LITE_MODE_BYTES = 4 * 1024 ** 3;
const MINUTE_MS = 60_000;
const LONG_PRESS_MS = 700;
const ESTIMATED_REST_HEIGHT = 290;
const DATE_LINE_HEIGHT = 18;

const copy = {
  day: {
    suggestion: 'Your chest felt tight earlier, so a slow exhale could help.',
  },
  night: {
    suggestion: 'Sleep breathing could slow things down before bed.',
  },
} as const;

function isNightCopy(minute: number): boolean {
  const m = wrapMinute(minute);
  return m >= skyTimes.duskStart || m < skyTimes.dawnStart;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function Chrome({ palette, words, selected, onSelect, headerTop, clearance, tabBottom, onSheetHeight, hidden }: {
  palette: Palette;
  words: { suggestion: string };
  selected: number;
  onSelect: (mood: number) => void;
  headerTop: number;
  clearance: number;
  tabBottom: number;
  onSheetHeight?: (event: LayoutChangeEvent) => void;
  hidden: boolean;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={hidden}>
      <View style={[styles.header, { paddingTop: headerTop }]} pointerEvents="none">
        <Text style={[styles.date, { color: palette.ink }]}>{formatDate(new Date())}</Text>
      </View>
      <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
        <View onLayout={onSheetHeight} style={styles.sheetBlock}>
          <Text style={[styles.heading, { color: palette.ink }]}>How are you arriving?</Text>
          <MoodRow mood={selected} palette={palette} onSelect={onSelect} />
          <View style={[styles.separator, { backgroundColor: palette.separator }]} />
          <View style={[styles.suggestion, { backgroundColor: palette.tint }]}>
            <Text style={[styles.body, styles.flex, { color: palette.ink }]}>{words.suggestion}</Text>
            <Pressable style={[styles.pill, { backgroundColor: palette.accent }]} accessibilityRole="button">
              <Text style={[styles.pillText, { color: palette.onAccent }]}>Breathe</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ height: clearance }} />
      </View>
      <TabBar palette={palette} bottom={tabBottom} />
    </View>
  );
}

function Today({ initialMinute, firstGust }: {
  initialMinute: number;
  firstGust: number;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const size = useMemo(() => ({ width, height }), [height, width]);
  const reducedMotion = useReducedMotion();
  const lite = (Device.totalMemory ?? LITE_MODE_BYTES) < LITE_MODE_BYTES;
  const moving = !reducedMotion && !lite;

  const [selected, setSelected] = useState<number>(moodNeutral);
  const [displayMinute, setDisplayMinute] = useState(initialMinute);
  const [overridden, setOverridden] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [textIsWhite, setTextIsWhite] = useState(() => skyTextIsWhite(initialMinute));
  const [restHeight, setRestHeight] = useState(ESTIMATED_REST_HEIGHT);

  const minute = useSharedValue(initialMinute);
  const mood = useSharedValue<number>(moodNeutral);
  const clock = useSharedValue(0);
  const shootingStartedAt = useSharedValue(-100);
  const nextShootingAt = useSharedValue<number>(skyMotion.shootingMinGap);
  const gust = useSharedValue<Gust>({ start: -100, count: 0, seed: 0 });
  const nextGustAt = useSharedValue<number>(firstGust);

  const solaSize = Math.min(sola.maxSize, Math.max(sola.minSize, height * sola.screenRatio));
  const headerTop = insets.top + spacing.lg;
  const dateBottom = headerTop + DATE_LINE_HEIGHT;
  // Sola sits low enough that its glow clears the date.
  const solaCenterY = dateBottom + solaSize * sola.glowRatio + spacing.sm;
  const clearance = tabBarHeight + insets.bottom + spacing.md + spacing.md;
  const restVisible = restHeight + clearance;
  const sceneTop = solaCenterY + solaSize * sola.sceneOverlap;
  const sceneBottom = height - restVisible + today.sheetOverlap;

  const bands = useMemo(
    () => ({
      dateBottom,
      solaCenterY,
      solaSize,
      scene: { width, top: sceneTop, height: Math.max(0, sceneBottom - sceneTop) },
    }),
    [dateBottom, sceneBottom, sceneTop, solaCenterY, solaSize, width],
  );

  const frame = useFrameCallback((info) => {
    // Continuous time: it only ever adds up, so loops never restart, even after a pause.
    const t = clock.get() + (info.timeSincePreviousFrame ?? 0) / 1000;
    clock.set(t);
    if (t >= nextShootingAt.get()) {
      shootingStartedAt.set(t);
      const gap = skyMotion.shootingMaxGap - skyMotion.shootingMinGap;
      nextShootingAt.set(t + skyMotion.shootingMinGap + Math.random() * gap);
    }
    // Mostly still. Every 15 to 30 seconds, a gust sways the branches and releases a few petals.
    if (t >= nextGustAt.get()) {
      // Every gust sways the branches. Only some release petals, and always the first.
      const span = wind.maxPetals - wind.minPetals + 1;
      const releases = gust.get().start < 0 || Math.random() < wind.releaseChance;
      const count = releases ? wind.minPetals + Math.floor(Math.random() * span) : 0;
      gust.set({ start: t, count, seed: Math.random() });
      nextGustAt.set(t + wind.minGap + Math.random() * (wind.maxGap - wind.minGap));
    }
  }, false);

  // Only animates while Today is focused and motion is allowed.
  useFocusEffect(
    useCallback(() => {
      frame.setActive(moving);
      return () => frame.setActive(false);
    }, [frame, moving]),
  );

  // Follow the real clock unless the hidden demo control has taken over.
  useEffect(() => {
    if (overridden) return undefined;
    const timer = setInterval(() => {
      const next = minuteOfDay(new Date());
      setDisplayMinute(next);
      const current = wrapMinute(minute.get());
      const delta = (next - current + 1440) % 1440;
      minute.set(withTiming(minute.get() + delta, { duration: duration.skyTick, easing }));
    }, MINUTE_MS);
    return () => clearInterval(timer);
  }, [minute, overridden]);

  useAnimatedReaction(
    () => skyTextIsWhite(minute.get()),
    (white, previous) => {
      if (white !== previous) scheduleOnRN(setTextIsWhite, white);
    },
  );

  const pickMood = useCallback(
    (level: number) => {
      mood.set(withSpring(level, spring));
      setSelected(level);
    },
    [mood],
  );

  const cycleSky = useCallback(() => {
    void Haptics.selectionAsync();
    const target = demoMinutes[demoIndex % demoMinutes.length] ?? demoMinutes[0];
    const current = wrapMinute(minute.get());
    const delta = (target - current + 1440) % 1440;
    minute.set(withTiming(minute.get() + delta, { duration: duration.skyJump, easing }));
    setOverridden(true);
    setDemoIndex(demoIndex + 1);
    setDisplayMinute(target);
  }, [demoIndex, minute]);

  const darkness = useSharedValue(textIsWhite ? 1 : 0);
  useEffect(() => {
    darkness.set(withTiming(textIsWhite ? 1 : 0, { duration: duration.entrance, easing }));
  }, [darkness, textIsWhite]);
  const lightStyle = useAnimatedStyle(() => ({ opacity: 1 - darkness.get() }));
  const darkStyle = useAnimatedStyle(() => ({ opacity: darkness.get() }));

  const measure = (setter: (value: number) => void) => (event: LayoutChangeEvent) =>
    setter(Math.ceil(event.nativeEvent.layout.height));

  const words = isNightCopy(displayMinute) ? copy.night : copy.day;

  return (
    <View style={styles.flex}>
      <StatusBar style={textIsWhite ? 'light' : 'dark'} />
      <SkyCanvas
        size={size}
        bands={bands}
        minute={minute}
        mood={mood}
        clock={clock}
        gust={gust}
        shootingStartedAt={shootingStartedAt}
        lite={lite}
      />

      <Pressable style={StyleSheet.absoluteFill} onLongPress={cycleSky} delayLongPress={LONG_PRESS_MS} accessible={false} />

      {/* One set of controls per scheme, cross-faded, so nothing snaps between light and dark. */}
      <Animated.View style={[StyleSheet.absoluteFill, lightStyle]} pointerEvents={textIsWhite ? 'none' : 'box-none'}>
        <Chrome palette={colors.light} words={words} selected={selected} onSelect={pickMood} headerTop={headerTop} clearance={clearance} tabBottom={insets.bottom + spacing.md} onSheetHeight={measure(setRestHeight)} hidden={textIsWhite} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, darkStyle]} pointerEvents={textIsWhite ? 'box-none' : 'none'}>
        <Chrome palette={colors.dark} words={words} selected={selected} onSelect={pickMood} headerTop={headerTop} clearance={clearance} tabBottom={insets.bottom + spacing.md} hidden={!textIsWhite} />
      </Animated.View>
    </View>
  );
}

export default function TodayScreen() {
  const params = useLocalSearchParams<{ m?: string; v?: string; gust?: string }>();
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  if (!loaded) return null;

  const fromParam = Number(params.m);
  const initialMinute = params.m && !Number.isNaN(fromParam) ? fromParam : minuteOfDay(new Date());
  const gustParam = Number(params.gust ?? 0);

  return (
    <Today
      key={`${params.m ?? ''}-${params.v ?? ''}`}
      initialMinute={initialMinute}
      firstGust={gustParam > 0 ? gustParam : wind.minGap}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: screenPadding },
  date: { fontFamily: font.semibold, fontSize: fontSize.footnote, lineHeight: DATE_LINE_HEIGHT },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  sheetBlock: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md },
  heading: { fontFamily: font.semibold, fontSize: fontSize.body },
  separator: { height: StyleSheet.hairlineWidth },
  body: { fontFamily: font.regular, fontSize: fontSize.callout, lineHeight: fontSize.callout * lineHeightRatio.body },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  pill: { borderRadius: radius.chip, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  pillText: { fontFamily: font.semibold, fontSize: fontSize.footnote },
});
