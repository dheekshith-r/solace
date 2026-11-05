// Today: the cards in a pull-up sheet, with the scene behind them (spec sections 7.7 and 8). Copy and
// numbers are sample data until Phase 3 connects the API. The m, open, gust and v params only
// exist for screenshots.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import * as Device from 'expo-device';
import { useFonts } from 'expo-font';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
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
import { minuteOfDay, moonPhase, wrapMinute } from '../src/features/sky/astro';
import { SkyCanvas, type Gust } from '../src/features/sky/SkyCanvas';
import { skyTextIsWhite } from '../src/features/sky/skyColors';
import { MoodRow, Ring, TabBar } from '../src/features/today/parts';
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
  titleTracking,
  today,
} from '../src/theme/tokens';

const LITE_MODE_BYTES = 4 * 1024 ** 3;
const MINUTE_MS = 60_000;
const LONG_PRESS_MS = 700;
const SAMPLE_STREAK_DAYS = 6;
const SAMPLE_STREAK_PROGRESS = 0.6;
const ESTIMATED_HEADLINE_HEIGHT = 100;
const ESTIMATED_REST_HEIGHT = 290;
const ESTIMATED_STATS_HEIGHT = 170;
const DATE_LINE_HEIGHT = 18;

const copy = {
  day: {
    line: "You said the exam felt heavy yesterday. How's it sitting this morning?",
    suggestion: 'Your chest felt tight earlier, so a slow exhale could help.',
    affirmation: 'You showed up yesterday, even when it was hard.',
  },
  night: {
    line: "The exam's been loud in your head all day. Want to set it down for tonight?",
    suggestion: 'Sleep breathing could slow things down before bed.',
    affirmation: 'Tomorrow can wait until tomorrow.',
  },
} as const;

function isNightCopy(minute: number): boolean {
  const m = wrapMinute(minute);
  return m >= skyTimes.duskStart || m < skyTimes.dawnStart;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function Today({ initialMinute, startOpen, firstGust }: {
  initialMinute: number;
  startOpen: boolean;
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
  const [moonValue] = useState(() => moonPhase(Date.now()));
  const [headlineHeight, setHeadlineHeight] = useState(ESTIMATED_HEADLINE_HEIGHT);
  const [restHeight, setRestHeight] = useState(ESTIMATED_REST_HEIGHT);
  const [statsHeight, setStatsHeight] = useState(ESTIMATED_STATS_HEIGHT);

  const minute = useSharedValue(initialMinute);
  const mood = useSharedValue<number>(moodNeutral);
  const clock = useSharedValue(0);
  const shootingStartedAt = useSharedValue(-100);
  const nextShootingAt = useSharedValue<number>(skyMotion.shootingMinGap);
  const gust = useSharedValue<Gust>({ start: -100, count: 0, seed: 0 });
  const nextGustAt = useSharedValue<number>(firstGust);
  const sheetOpen = useSharedValue(startOpen ? 1 : 0);
  const dragStart = useSharedValue(0);

  const solaSize = Math.min(sola.maxSize, Math.max(sola.minSize, height * sola.screenRatio));
  const headerTop = insets.top + spacing.lg;
  const dateBottom = headerTop + DATE_LINE_HEIGHT;
  const solaTop = dateBottom + spacing.sm;
  const headlineBottom = solaTop + solaSize + spacing.sm + headlineHeight;
  const clearance = tabBarHeight + insets.bottom + spacing.md + spacing.md;
  const restVisible = restHeight + clearance;
  const sceneTop = headlineBottom + spacing.xs;
  const sceneBottom = height - restVisible + today.sheetOverlap;

  const bands = useMemo(
    () => ({
      dateBottom,
      solaCenterY: solaTop + solaSize / 2,
      solaSize,
      scene: { width, top: sceneTop, height: Math.max(0, sceneBottom - sceneTop) },
    }),
    [dateBottom, sceneBottom, sceneTop, solaSize, solaTop, width],
  );

  const frame = useFrameCallback((info) => {
    const t = info.timeSinceFirstFrame / 1000;
    clock.set(t);
    if (t >= nextShootingAt.get()) {
      shootingStartedAt.set(t);
      const gap = skyMotion.shootingMaxGap - skyMotion.shootingMinGap;
      nextShootingAt.set(t + skyMotion.shootingMinGap + Math.random() * gap);
    }
    // Mostly still. Every 15 to 30 seconds, a gust sways the branches and releases a few petals.
    if (t >= nextGustAt.get()) {
      const span = wind.maxPetals - wind.minPetals + 1;
      gust.set({ start: t, count: wind.minPetals + Math.floor(Math.random() * span), seed: Math.random() });
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
    const target = demoMinutes[demoIndex % demoMinutes.length] ?? demoMinutes[0];
    const current = wrapMinute(minute.get());
    const delta = (target - current + 1440) % 1440;
    minute.set(withTiming(minute.get() + delta, { duration: duration.skyJump, easing }));
    setOverridden(true);
    setDemoIndex(demoIndex + 1);
    setDisplayMinute(target);
  }, [demoIndex, minute]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-spacing.md, spacing.md])
        .onBegin(() => {
          dragStart.set(sheetOpen.get());
        })
        .onUpdate((event) => {
          const next = dragStart.get() - event.translationY / Math.max(1, statsHeight);
          sheetOpen.set(Math.min(1, Math.max(0, next)));
        })
        .onEnd(() => {
          const opening = sheetOpen.get() > dragStart.get();
          const moved = Math.abs(sheetOpen.get() - dragStart.get()) > today.sheetDragThreshold;
          const open = moved ? opening : dragStart.get() > 0.5;
          sheetOpen.set(withSpring(open ? 1 : 0, spring));
        }),
    [dragStart, sheetOpen, statsHeight],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(sheetOpen.get(), [0, 1], [statsHeight, 0]) }],
  }));
  const statsStyle = useAnimatedStyle(() => ({ opacity: sheetOpen.get() }));

  const measure = (setter: (value: number) => void) => (event: LayoutChangeEvent) =>
    setter(Math.ceil(event.nativeEvent.layout.height));

  const skyText = textIsWhite ? colors.dark.ink : colors.light.ink;
  const palette = textIsWhite ? colors.dark : colors.light;
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
        moonPhaseValue={moonValue}
        lite={lite}
      />

      <Pressable style={StyleSheet.absoluteFill} onLongPress={cycleSky} delayLongPress={LONG_PRESS_MS} accessible={false} />

      <View style={[styles.header, { paddingTop: headerTop }]} pointerEvents="none">
        <Text style={[styles.date, { color: skyText }]}>{formatDate(new Date())}</Text>
        <View style={{ height: solaSize, marginVertical: spacing.sm }} />
        <Text
          style={[styles.line, { color: skyText }]}
          accessibilityRole="header"
          onLayout={measure(setHeadlineHeight)}
        >
          {words.line}
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.sheet, { backgroundColor: palette.surface }, sheetStyle]}>
          <View onLayout={measure(setRestHeight)} style={styles.sheetBlock}>
            <View style={[styles.handle, { backgroundColor: palette.separator }]} />
            <Text style={[styles.heading, { color: palette.ink }]}>How are you arriving?</Text>
            <MoodRow mood={selected} palette={palette} onSelect={pickMood} />
            <View style={[styles.separator, { backgroundColor: palette.separator }]} />
            <View style={[styles.suggestion, { backgroundColor: palette.tint }]}>
              <Text style={[styles.body, styles.flex, { color: palette.ink }]}>{words.suggestion}</Text>
              <Pressable style={[styles.pill, { backgroundColor: palette.accent }]} accessibilityRole="button">
                <Text style={[styles.pillText, { color: palette.onAccent }]}>Breathe</Text>
              </Pressable>
            </View>
          </View>

          <Animated.View onLayout={measure(setStatsHeight)} style={[styles.statsBlock, statsStyle]}>
            <View style={styles.statRow}>
              <View style={[styles.statCard, { backgroundColor: palette.tint }]}>
                <Ring palette={palette} progress={SAMPLE_STREAK_PROGRESS} label={String(SAMPLE_STREAK_DAYS)} />
                <Text style={[styles.caption, { color: palette.ink }]}>{SAMPLE_STREAK_DAYS}-day streak</Text>
              </View>
              <View style={[styles.statCard, styles.flex, { backgroundColor: palette.tint }]}>
                <Text style={[styles.caption, { color: palette.muted }]}>For today</Text>
                <Text style={[styles.body, { color: palette.ink }]}>{words.affirmation}</Text>
              </View>
            </View>
          </Animated.View>
          <View style={{ height: clearance }} />
        </Animated.View>
      </GestureDetector>

      <TabBar palette={palette} bottom={insets.bottom + spacing.md} />
    </View>
  );
}

export default function TodayScreen() {
  const params = useLocalSearchParams<{ m?: string; open?: string; v?: string; gust?: string }>();
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
      key={`${params.m ?? ''}-${params.open ?? ''}-${params.v ?? ''}`}
      initialMinute={initialMinute}
      startOpen={params.open === '1'}
      firstGust={gustParam > 0 ? gustParam : wind.minGap}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: screenPadding },
  date: { fontFamily: font.semibold, fontSize: fontSize.footnote, lineHeight: DATE_LINE_HEIGHT },
  line: {
    fontFamily: font.bold,
    fontSize: fontSize.title,
    lineHeight: fontSize.title * lineHeightRatio.title,
    letterSpacing: fontSize.title * titleTracking,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  sheetBlock: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
  statsBlock: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  handle: {
    alignSelf: 'center',
    width: today.sheetHandleWidth,
    height: today.sheetHandleHeight,
    borderRadius: radius.full,
  },
  heading: { fontFamily: font.semibold, fontSize: fontSize.body },
  separator: { height: StyleSheet.hairlineWidth },
  body: { fontFamily: font.regular, fontSize: fontSize.callout, lineHeight: fontSize.callout * lineHeightRatio.body },
  caption: { fontFamily: font.semibold, fontSize: fontSize.footnote },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  pill: { borderRadius: radius.chip, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  pillText: { fontFamily: font.semibold, fontSize: fontSize.footnote },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm },
});
