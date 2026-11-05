// Today, built around the living sky (spec sections 7.7 and 8). Copy and streak are sample data
// until Phase 3 connects the API. The m and fresh params only exist for screenshots.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import * as Device from 'expo-device';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { minuteOfDay, moonPhase, wrapMinute } from '../src/features/sky/astro';
import { SkyCanvas } from '../src/features/sky/SkyCanvas';
import { skyTextIsWhite } from '../src/features/sky/skyColors';
import { storage, storageKeys } from '../src/lib/storage';
import { duration, easing, spring } from '../src/theme/motion';
import {
  demoMinutes,
  moodLabels,
  moodLevels,
  moodNeutral,
  skyLayout,
  skyMotion,
  skyTimes,
  sola,
} from '../src/theme/sky';
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
  touchTarget,
} from '../src/theme/tokens';

const LITE_MODE_BYTES = 4 * 1024 ** 3;
const MINUTE_MS = 60_000;
const SAMPLE_STREAK_DAYS = 5;
const LONG_PRESS_MS = 700;
const LEVELS = Array.from({ length: moodLevels }, (_, i) => moodLevels - i);
const TABS = ['Today', 'Sola', 'You'] as const;

const copy = {
  day: {
    line: "You said the exam felt heavy yesterday. How's it sitting this morning?",
    suggestion: 'Your chest felt tight earlier, so a slow exhale could help.',
    action: 'Breathe',
  },
  night: {
    line: "The exam's been loud in your head all day. Want to set it down for tonight?",
    suggestion: 'Sleep breathing could slow things down before bed.',
    action: 'Breathe',
  },
} as const;

function isNightCopy(minute: number): boolean {
  const m = wrapMinute(minute);
  return m >= skyTimes.duskStart || m < skyTimes.dawnStart;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function Today({ initialMinute, showHintFirst }: { initialMinute: number; showHintFirst: boolean }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const size = useMemo(() => ({ width, height }), [height, width]);
  const reducedMotion = useReducedMotion();
  const lite = (Device.totalMemory ?? LITE_MODE_BYTES) < LITE_MODE_BYTES;
  const moving = !reducedMotion && !lite;

  const levelTop = height * skyLayout.levelTop;
  const levelGap = (height * (skyLayout.levelBottom - skyLayout.levelTop)) / (moodLevels - 1);
  const yForMood = useCallback(
    (m: number) => {
      'worklet';
      return levelTop + (moodLevels - m) * levelGap;
    },
    [levelGap, levelTop],
  );

  const [selected, setSelected] = useState<number>(moodNeutral);
  const [showHint, setShowHint] = useState(showHintFirst);
  const [displayMinute, setDisplayMinute] = useState(initialMinute);
  const [overridden, setOverridden] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [moonValue] = useState(() => moonPhase(Date.now()));
  const [textIsWhite, setTextIsWhite] = useState(() => skyTextIsWhite(initialMinute, moodNeutral));

  const minute = useSharedValue(initialMinute);
  const mood = useSharedValue<number>(moodNeutral);
  const clock = useSharedValue(0);
  const shootingStartedAt = useSharedValue(-100);
  const nextShootingAt = useSharedValue<number>(skyMotion.shootingMinGap);
  const bob = useSharedValue(0);
  const dragStart = useSharedValue<number>(moodNeutral);

  const solaY = useDerivedValue(() => yForMood(mood.get()) + bob.get());

  const frame = useFrameCallback((info) => {
    const t = info.timeSinceFirstFrame / 1000;
    clock.set(t);
    if (t >= nextShootingAt.get()) {
      shootingStartedAt.set(t);
      const gap = skyMotion.shootingMaxGap - skyMotion.shootingMinGap;
      nextShootingAt.set(t + skyMotion.shootingMinGap + Math.random() * gap);
    }
  }, false);

  // The canvas only animates while Today is focused and motion is allowed.
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
    () => skyTextIsWhite(minute.get(), mood.get()),
    (white, previous) => {
      if (white !== previous) scheduleOnRN(setTextIsWhite, white);
    },
  );

  // A small bob for the one-time hint, never shown again after the first check-in.
  useEffect(() => {
    if (!showHint || !moving) return undefined;
    bob.set(
      withRepeat(
        withSequence(
          withTiming(-sola.floatDistance * 3, { duration: duration.hintBob, easing }),
          withTiming(0, { duration: duration.hintBob, easing }),
        ),
        -1,
      ),
    );
    return () => bob.set(0);
  }, [bob, moving, showHint]);

  const commitMood = useCallback((level: number) => {
    void Haptics.selectionAsync();
    setSelected(level);
    setShowHint(false);
    storage.set(storageKeys.hasCheckedIn, true);
  }, []);

  const selectLevel = useCallback(
    (level: number) => {
      mood.set(withSpring(level, spring));
      commitMood(level);
    },
    [commitMood, mood],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          dragStart.set(mood.get());
        })
        .onUpdate((event) => {
          const next = dragStart.get() - event.translationY / levelGap;
          mood.set(Math.min(moodLevels, Math.max(1, next)));
        })
        .onEnd(() => {
          const level = Math.round(mood.get());
          mood.set(withSpring(level, spring));
          scheduleOnRN(commitMood, level);
        }),
    [commitMood, dragStart, levelGap, mood],
  );

  const followSola = useAnimatedStyle(() => ({ transform: [{ translateY: solaY.get() }] }));

  const cycleSky = useCallback(() => {
    const target = demoMinutes[demoIndex % demoMinutes.length] ?? demoMinutes[0];
    const current = wrapMinute(minute.get());
    const delta = (target - current + 1440) % 1440;
    minute.set(withTiming(minute.get() + delta, { duration: duration.skyJump, easing }));
    setOverridden(true);
    setDemoIndex(demoIndex + 1);
    setDisplayMinute(target);
  }, [demoIndex, minute]);

  const skyText = textIsWhite ? colors.dark.ink : colors.light.ink;
  const palette = textIsWhite ? colors.dark : colors.light;
  const words = isNightCopy(displayMinute) ? copy.night : copy.day;
  const solaLeft = width * skyLayout.solaX;
  const bubbleWidth = width - screenPadding * 2 - touchTarget - spacing.sm;

  return (
    <View style={styles.flex}>
      <StatusBar style={textIsWhite ? 'light' : 'dark'} />
      <SkyCanvas
        size={size}
        minute={minute}
        mood={mood}
        solaY={solaY}
        clock={clock}
        shootingStartedAt={shootingStartedAt}
        moonPhaseValue={moonValue}
        streakDays={SAMPLE_STREAK_DAYS}
        lite={lite}
        moving={moving}
      />

      <Pressable
        style={StyleSheet.absoluteFill}
        onLongPress={cycleSky}
        delayLongPress={LONG_PRESS_MS}
        accessible={false}
      />

      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]} pointerEvents="none">
        <Text style={[styles.date, { color: skyText }]}>{formatDate(new Date())}</Text>
        <Text style={[styles.line, { color: skyText }]} accessibilityRole="header">
          {words.line}
        </Text>
      </View>

      {LEVELS.map((level) => {
        const isSelected = level === selected;
        return (
          <Pressable
            key={level}
            onPress={() => selectLevel(level)}
            accessibilityRole="button"
            accessibilityLabel={moodLabels[level - 1]}
            accessibilityState={{ selected: isSelected }}
            style={[styles.level, { top: levelTop + (moodLevels - level) * levelGap - touchTarget / 2 }]}
          >
            {isSelected ? (
              <View style={[styles.levelLabel, { backgroundColor: palette.surface }]}>
                <Text style={[styles.levelLabelText, { color: palette.ink }]}>{moodLabels[level - 1]}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.levelDot,
                isSelected ? styles.levelDotSelected : undefined,
                { backgroundColor: skyText },
              ]}
            />
          </Pressable>
        );
      })}

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.solaHit, { left: solaLeft - sola.hitSize / 2, top: -sola.hitSize / 2 }, followSola]}
          accessibilityLabel="Sola. Drag up or down to show how you feel."
        />
      </GestureDetector>

      <Animated.View
        style={[styles.bubble, { top: sola.bubbleOffset, width: bubbleWidth, backgroundColor: palette.surface }, followSola]}
      >
        <View
          style={[styles.bubbleTail, { left: solaLeft - screenPadding - spacing.sm, backgroundColor: palette.surface }]}
        />
        {showHint ? (
          <Text style={[styles.bubbleText, { color: palette.ink }]}>Slide me to show how you feel</Text>
        ) : (
          <>
            <Text style={[styles.bubbleText, { color: palette.ink }]}>{words.suggestion}</Text>
            <Pressable
              style={[styles.bubbleAction, { backgroundColor: palette.accent }]}
              accessibilityRole="button"
            >
              <Text style={[styles.bubbleActionText, { color: palette.onAccent }]}>{words.action}</Text>
            </Pressable>
          </>
        )}
      </Animated.View>

      <View
        style={[styles.tabBar, { backgroundColor: palette.surface, bottom: insets.bottom + spacing.md, shadowColor: palette.ink }]}
      >
        {TABS.map((tab, index) => (
          <View key={tab} style={[styles.tab, index === 0 ? { backgroundColor: palette.accent } : undefined]}>
            <Text style={[styles.tabText, { color: index === 0 ? palette.onAccent : palette.muted }]}>{tab}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function TodayScreen() {
  const params = useLocalSearchParams<{ m?: string; fresh?: string }>();
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  if (!loaded) return null;

  const fromParam = Number(params.m);
  const initialMinute = params.m && !Number.isNaN(fromParam) ? fromParam : minuteOfDay(new Date());
  const showHintFirst = params.fresh === '1' || !storage.getBoolean(storageKeys.hasCheckedIn);

  return (
    <Today
      key={`${params.m ?? ''}-${params.fresh ?? ''}`}
      initialMinute={initialMinute}
      showHintFirst={showHintFirst}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: screenPadding, gap: spacing.sm },
  date: { fontFamily: font.semibold, fontSize: fontSize.footnote },
  line: {
    fontFamily: font.bold,
    fontSize: fontSize.title,
    lineHeight: fontSize.title * lineHeightRatio.title,
    letterSpacing: fontSize.title * titleTracking,
  },
  level: {
    position: 'absolute',
    right: screenPadding,
    height: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    minWidth: touchTarget,
  },
  levelDot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.full, opacity: 0.55 },
  levelDotSelected: { width: spacing.md, height: spacing.md, opacity: 1 },
  levelLabel: { borderRadius: radius.chip, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  levelLabelText: { fontFamily: font.semibold, fontSize: fontSize.footnote },
  solaHit: { position: 'absolute', width: sola.hitSize, height: sola.hitSize },
  bubble: {
    position: 'absolute',
    left: screenPadding,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  bubbleTail: {
    position: 'absolute',
    top: -spacing.xs - 2,
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: spacing.xs,
    transform: [{ rotate: '45deg' }],
  },
  bubbleText: {
    fontFamily: font.regular,
    fontSize: fontSize.callout,
    lineHeight: fontSize.callout * lineHeightRatio.body,
  },
  bubbleAction: {
    alignSelf: 'flex-start',
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  bubbleActionText: { fontFamily: font.semibold, fontSize: fontSize.callout },
  tabBar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    height: tabBarHeight,
    padding: spacing.xs + spacing.xs / 2,
    gap: spacing.xs,
    borderRadius: radius.full,
    elevation: 10,
    shadowOpacity: 0.18,
    shadowRadius: spacing.lg,
    shadowOffset: { width: 0, height: spacing.sm },
  },
  tab: { paddingHorizontal: spacing.xxl, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: font.semibold, fontSize: fontSize.callout },
});
