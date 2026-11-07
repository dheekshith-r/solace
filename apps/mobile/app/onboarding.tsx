// Onboarding: four steps over the sky (spec 8.2). Choices are kept on the phone until sign-up (ticket 05).
import { AndroidImportance, requestPermissionsAsync, setNotificationChannelAsync } from 'expo-notifications';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { Bell, Sparkles, Wind } from 'lucide-react-native';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { BackHandler, Platform, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Entrance, ListGroup, ListRow, ProgressDashes, Text, ThemeProvider } from '../src/components';
import { ONBOARDING_STEPS, useOnboarding, type Goal, type ReminderKind } from '../src/features/onboarding/store';
import { SolaFigure } from '../src/features/sola/Sola';
import { SkyBackdrop, skySchemeNow } from '../src/features/sky/SkyBackdrop';
import { kit, screenPadding, spacing } from '../src/theme/tokens';
import { ROOT_ID } from '../src/components/testId';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'sleep', label: 'Better sleep' },
  { value: 'focus', label: 'Focus' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'connection', label: 'Connection' },
];

const REMINDERS: { kind: ReminderKind; title: string; icon: typeof Bell }[] = [
  { kind: 'checkin', title: 'Evening mood check-in', icon: Bell },
  { kind: 'affirmation', title: 'Morning affirmation', icon: Sparkles },
  { kind: 'breathe', title: 'Midday breathing break', icon: Wind },
];

function Page({ width, children }: { width: number; children: React.ReactNode }) {
  return <View style={[styles.page, { width }]}>{children}</View>;
}

function Words({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.words}>
      <Text variant="title" center accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body" tone="muted" center>
        {body}
      </Text>
    </View>
  );
}

function Steps({ glow }: { glow: 'day' | 'night' }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const { step, goal, reminders, setStep, setGoal, toggleReminder, setPermission, finish } = useOnboarding();
  const [asking, setAsking] = useState(false);

  const go = useCallback(
    (next: number) => {
      setStep(next);
      pager.current?.scrollTo({ x: next * width, animated: true });
    },
    [setStep, width],
  );

  const complete = useCallback(
    (allowed: boolean) => {
      finish(allowed);
      router.replace('/sign-up');
    },
    [finish, router],
  );

  const askPermission = useCallback(async () => {
    setAsking(true);
    try {
      // Android 13+ only shows the permission prompt once a channel exists.
      if (Platform.OS === 'android') {
        await setNotificationChannelAsync('checkin', { name: 'Mood check-in', importance: AndroidImportance.DEFAULT });
      }
      const result = await requestPermissionsAsync();
      setPermission(result.granted ? 'granted' : 'denied');
      complete(result.granted);
    } catch {
      setPermission('denied');
      complete(false);
    } finally {
      setAsking(false);
    }
  }, [complete, setPermission]);

  // Back steps back through onboarding; on the first step it leaves the app as usual.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step === 0) return false;
        go(step - 1);
        return true;
      });
      return () => sub.remove();
    }, [go, step]),
  );

  const onSwipeEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    // The goal step can't be swiped past without a choice.
    if (page > 2 && !goal) {
      go(2);
      return;
    }
    setStep(page);
  };

  const anyReminder = reminders.checkin.on || reminders.affirmation.on || reminders.breathe.on;
  const primary =
    step === 0
      ? { label: 'Get started', onPress: () => go(1) }
      : step === 1
        ? { label: 'Nice to meet you', onPress: () => go(2) }
        : step === 2
          ? { label: 'Continue', onPress: () => go(3), disabled: !goal }
          : { label: anyReminder ? 'Turn on reminders' : 'Continue', onPress: () => (anyReminder ? void askPermission() : complete(false)) };

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]} testID={ROOT_ID} collapsable={false}>
      <View style={styles.top}>
        <ProgressDashes count={ONBOARDING_STEPS} current={step} />
        {step >= 1 ? (
          <Button label="Skip" variant="text" onPress={() => complete(false)} accessibilityHint="Skips setup. You can choose a goal and reminders later in settings." />
        ) : (
          <View style={styles.skipSpace} />
        )}
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onSwipeEnd}
        contentOffset={{ x: step * width, y: 0 }}
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
      >
        <Page width={width}>
          <Entrance index={0}>
            <SolaFigure size={kit.heroSola} glow={glow} mood={4} />
          </Entrance>
          <Entrance index={1}>
            <Words title="A calm place to land" body="Check in with how you feel, talk things through with Sola, and find one small step that helps." />
          </Entrance>
        </Page>

        <Page width={width}>
          <SolaFigure size={kit.heroSola} glow={glow} mood={5} waving={step === 1} />
          <Words
            title="Hi, I'm Sola"
            body="I'll listen, remember what matters to you, and suggest something small when it fits. I'm a friendly guide, not a therapist."
          />
        </Page>

        <Page width={width}>
          <Words title="What would help most?" body="Sola will lean your suggestions toward it. You can change this anytime." />
          <View style={styles.chips} accessibilityRole="radiogroup">
            {GOALS.map((g) => (
              <Chip key={g.value} label={g.label} selected={goal === g.value} onPress={() => setGoal(g.value)} />
            ))}
          </View>
        </Page>

        <Page width={width}>
          <Words title="Gentle reminders" body="Sola checks in at these times, in its own voice. Your phone will ask for permission next." />
          <View style={styles.list}>
            <ListGroup>
              {REMINDERS.map((r) => (
                <ListRow
                  key={r.kind}
                  icon={r.icon}
                  title={r.title}
                  subtitle={reminders[r.kind].time}
                  trailing={{ kind: 'switch', on: reminders[r.kind].on, onChange: (on) => toggleReminder(r.kind, on) }}
                />
              ))}
            </ListGroup>
          </View>
        </Page>
      </ScrollView>

      <View style={styles.actions}>
        <Button label={primary.label} onPress={primary.onPress} disabled={primary.disabled} loading={asking} wide />
        {step === 3 && anyReminder ? <Button label="Not now" variant="text" align="center" onPress={() => complete(false)} /> : null}
        {step === 0 ? <Button label="I already have an account" variant="text" align="center" onPress={() => router.replace('/log-in')} /> : null}
      </View>
    </View>
  );
}

export default function Onboarding() {
  // The page follows the sky outside: light by day, dark at night, like Today. m (minute of day) is for screenshots only.
  const { m } = useLocalSearchParams<{ m?: string }>();
  const [scheme] = useState(() => skySchemeNow(m ? Number(m) : undefined));
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );
  return (
    <ThemeProvider scheme={scheme}>
      <SkyBackdrop minute={m ? Number(m) : undefined} />
      <Steps glow={scheme === 'dark' ? 'night' : 'day'} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: screenPadding, minHeight: kit.rowMinHeight },
  skipSpace: { height: kit.chipHeight },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenPadding, gap: spacing.xxl },
  words: { gap: spacing.md, maxWidth: kit.pageMaxText, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, maxWidth: kit.pageMaxText },
  list: { alignSelf: 'stretch' },
  actions: { paddingHorizontal: screenPadding, gap: spacing.xs, alignItems: 'center' },
});
