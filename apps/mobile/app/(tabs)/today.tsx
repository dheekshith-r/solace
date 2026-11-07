// Today: the mood check-in and suggestion in a sheet, with the scene behind them (spec sections 7.7 and 8). Copy and
// numbers are sample data until Phase 3 connects the API. The m, gust, v, perf and raster params only
// exist for screenshots.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import * as Device from 'expo-device';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
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
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { minuteOfDay, wrapMinute } from '../../src/features/sky/astro';
import { SkyCanvas, type Gust } from '../../src/features/sky/SkyCanvas';
import { addFrame, configurePerf, describeWindow, emptyFrameWindow, logPerf, type FrameWindow } from '../../src/features/sky/perf';
import { nightAmount, skyTextIsWhite } from '../../src/features/sky/skyColors';
import { todayChromeDarkness } from '../../src/features/today/chrome';
import { actionLabel, flushPendingMood, queueMood, useToday } from '../../src/features/today/data';
import { MoodRow, NO_MOOD } from '../../src/features/today/parts';
import { ROOT_ID } from '../../src/components/testId';
import { duration, easing, spring } from '../../src/theme/motion';
import { demoMinutes, moodNeutral, skyMotion, skyTimes, sola, wind } from '../../src/theme/sky';
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
} from '../../src/theme/tokens';

const LITE_MODE_BYTES = 4 * 1024 ** 3;
const MINUTE_MS = 60_000;
const LONG_PRESS_MS = 700;
const ESTIMATED_REST_HEIGHT = 290;
const DATE_LINE_HEIGHT = 18;
const PERF_WINDOW_S = 5;

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

function Chrome({ palette, words, level, onSelect, headerTop, clearance, onSheetHeight, hidden, logged }: {
  logged: number | null;

  palette: Palette;
  words: { suggestion: string; action: string; href: '/breathe' | '/reflect' };
  level: SharedValue<number>;
  onSelect: (mood: number) => void;
  headerTop: number;
  clearance: number;
  onSheetHeight?: (event: LayoutChangeEvent) => void;
  hidden: boolean;
}) {
  const router = useRouter();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={hidden}>
      <View style={[styles.header, { paddingTop: headerTop }]} pointerEvents="none">
        <Text style={[styles.date, { color: palette.ink }]}>{formatDate(new Date())}</Text>
      </View>
      <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
        <View onLayout={onSheetHeight} style={styles.sheetBlock}>
          <Text style={[styles.heading, { color: palette.ink }]}>How are you arriving?</Text>
          <MoodRow level={level} palette={palette} onSelect={onSelect} logged={logged} />
          <View style={[styles.separator, { backgroundColor: palette.separator }]} />
          <View style={[styles.suggestion, { backgroundColor: palette.tint }]}>
            <Text style={[styles.body, styles.flex, { color: palette.ink }]}>{words.suggestion}</Text>
            <Pressable style={[styles.pill, { backgroundColor: palette.accent }]} accessibilityRole="button" testID="today-suggestion" onPress={() => router.push(words.href)}>
              <Text style={[styles.pillText, { color: palette.onAccent }]}>{words.action}</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ height: clearance }} />
      </View>
    </View>
  );
}

function Today({ initialMinute, firstGust, perf }: {
  initialMinute: number;
  firstGust: number;
  perf: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const size = useMemo(() => ({ width, height }), [height, width]);
  const reducedMotion = useReducedMotion();
  const lite = (Device.totalMemory ?? LITE_MODE_BYTES) < LITE_MODE_BYTES;
  const moving = !reducedMotion && !lite;

  const [displayMinute, setDisplayMinute] = useState(initialMinute);
  const [overridden, setOverridden] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [textIsWhite, setTextIsWhite] = useState(() => skyTextIsWhite(initialMinute));
  const [restHeight, setRestHeight] = useState<number | null>(null);
  // The light/dark fade: a second copy of the controls exists only while it runs.
  const [fadingFrom, setFadingFrom] = useState<Palette | null>(null);

  const minute = useSharedValue(initialMinute);
  // Sola's face starts neutral; the mood row starts with nothing selected (Ddk, Nov 7).
  const mood = useSharedValue<number>(moodNeutral);
  const level = useSharedValue<number>(NO_MOOD);
  const chromeFade = useSharedValue(0);
  const frameWindow = useSharedValue<FrameWindow>(emptyFrameWindow(0));
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
  const restVisible = (restHeight ?? ESTIMATED_REST_HEIGHT) + clearance;
  const sceneTop = solaCenterY + solaSize * sola.sceneOverlap;
  const sceneBottom = height - restVisible + today.sheetOverlap;

  const [startsAtNight] = useState(() => nightAmount(initialMinute) > 0.5);
  const reportFrames = useCallback((w: FrameWindow) => logPerf(describeWindow(w)), []);

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
    if (perf && info.timeSincePreviousFrame !== null) {
      const w = addFrame(frameWindow.get(), info.timeSincePreviousFrame);
      if (t - w.started >= PERF_WINDOW_S) {
        scheduleOnRN(reportFrames, w);
        frameWindow.set(emptyFrameWindow(t));
      } else {
        frameWindow.set(w);
      }
    }
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

  // Tab screens stay mounted, so the status bar and tab bar scheme are set on focus, not on mount.
  // A mood tapped while offline is sent the next time Today opens.
  useEffect(() => {
    void flushPendingMood();
  }, []);
  // The tab bar's scheme starts from the sky this screen opened with; changeScheme fades it after that.
  useEffect(() => {
    todayChromeDarkness.set(skyTextIsWhite(initialMinute) ? 1 : 0);
  }, [initialMinute]);
  // On focus, only the status bar is set (from the tab bar's current scheme), so a running fade is never cut short.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(todayChromeDarkness.get() > 0.5 ? 'light' : 'dark');
    }, []),
  );

  // Follow the real clock unless the hidden demo control has taken over.
  const followClock = useCallback(() => {
    const next = minuteOfDay(new Date());
    const current = wrapMinute(minute.get());
    const delta = (next - current + 1440) % 1440;
    if (delta === 0) return;
    setDisplayMinute(next);
    minute.set(withTiming(minute.get() + delta, { duration: duration.skyTick, easing }));
  }, [minute]);

  // Only draws while Today is focused (ticket 08b): the scene stays mounted behind other tabs but
  // is still. On return the sky catches up to the clock, and motion resumes if it's allowed.
  useFocusEffect(
    useCallback(() => {
      frame.setActive(moving);
      if (overridden) return () => frame.setActive(false);
      followClock();
      const timer = setInterval(followClock, MINUTE_MS);
      return () => {
        frame.setActive(false);
        clearInterval(timer);
      };
    }, [frame, moving, overridden, followClock]),
  );

  const clearFade = useCallback(() => setFadingFrom(null), []);
  const changeScheme = useCallback(
    (white: boolean) => {
      setFadingFrom(white ? colors.light : colors.dark);
      setTextIsWhite(white);
      // The tab bar lives in the tabs layout; it follows the same fade.
      todayChromeDarkness.set(withTiming(white ? 1 : 0, { duration: duration.entrance, easing }));
      setStatusBarStyle(white ? 'light' : 'dark');
      chromeFade.set(1);
      chromeFade.set(
        withTiming(0, { duration: duration.entrance, easing }, (finished) => {
          if (finished) scheduleOnRN(clearFade);
        }),
      );
    },
    [chromeFade, clearFade],
  );
  useAnimatedReaction(
    () => skyTextIsWhite(minute.get()),
    (white, previous) => {
      if (previous !== null && white !== previous) scheduleOnRN(changeScheme, white);
    },
  );

  // No React state here: a tap doesn't re-render this screen or redraw the scene from scratch.
  const pickMood = useCallback(
    (next: number) => {
      mood.set(withSpring(next, spring));
      queueMood(next);
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

  const fadeStyle = useAnimatedStyle(() => ({ opacity: chromeFade.get() }));
  // Measured once: the scene is baked to this size, and baking twice wastes memory and time.
  const onSheetHeight = useCallback((event: LayoutChangeEvent) => {
    const measured = Math.ceil(event.nativeEvent.layout.height);
    setRestHeight((current) => current ?? measured);
  }, []);

  // Sample copy until the API answers; then Sola's real suggestion (ticket 06).
  const todayData = useToday().data;
  // A mood logged earlier today shows as chosen, and Sola's face follows it. Otherwise both stay neutral.
  const loggedToday =
    todayData?.lastMood && new Date(todayData.lastMood.createdAt).toDateString() === new Date().toDateString() ? todayData.lastMood.mood : null;
  useEffect(() => {
    if (loggedToday !== null && level.get() === NO_MOOD) mood.set(withSpring(loggedToday, spring));
  }, [loggedToday, level, mood]);
  const fallback = isNightCopy(displayMinute) ? copy.night : copy.day;
  const words = todayData
    ? { suggestion: todayData.suggestion.text, action: actionLabel[todayData.suggestion.action], href: todayData.suggestion.action === 'reflect' ? ('/reflect' as const) : ('/breathe' as const) }
    : { suggestion: fallback.suggestion, action: actionLabel.breathe, href: '/breathe' as const };

  return (
    <View style={styles.flex} testID={ROOT_ID} collapsable={false}>
      <SkyCanvas
        size={size}
        bands={bands}
        sceneReady={restHeight !== null}
        startsAtNight={startsAtNight}
        minute={minute}
        mood={mood}
        clock={clock}
        gust={gust}
        shootingStartedAt={shootingStartedAt}
        lite={lite}
      />

      <Pressable style={StyleSheet.absoluteFill} onLongPress={cycleSky} delayLongPress={LONG_PRESS_MS} accessible={false} />

      <Chrome palette={textIsWhite ? colors.dark : colors.light} words={words} level={level} onSelect={pickMood} headerTop={headerTop} clearance={clearance} onSheetHeight={onSheetHeight} hidden={false} logged={loggedToday} />
      {fadingFrom ? (
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]} pointerEvents="none">
          <Chrome palette={fadingFrom} words={words} level={level} onSelect={pickMood} headerTop={headerTop} clearance={clearance} hidden logged={loggedToday} />
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function TodayScreen() {
  const params = useLocalSearchParams<{ m?: string; v?: string; gust?: string; perf?: string; raster?: string }>();
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  // Baking waits for the first frame, so this runs in time to measure it.
  useEffect(() => configurePerf(params.perf === '1', params.raster === '1'), [params.perf, params.raster]);
  if (!loaded) return null;

  const fromParam = Number(params.m);
  const initialMinute = params.m && !Number.isNaN(fromParam) ? fromParam : minuteOfDay(new Date());
  const gustParam = Number(params.gust ?? 0);

  return (
    <Today
      key={`${params.m ?? ''}-${params.v ?? ''}`}
      initialMinute={initialMinute}
      firstGust={gustParam > 0 ? gustParam : wind.minGap}
      perf={params.perf === '1'}
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
