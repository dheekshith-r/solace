// Breathe (spec 8.7): mood before, a pattern, four rounds with the orb, then mood after.
import { activityResponseSchema, checkinResponseSchema } from '@solace/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, Entrance, MoodFace, MoodPicker, PressScale, Text, useTheme } from '../src/components';
import { authed } from '../src/features/auth/session';
import { Orb } from '../src/features/breathe/Orb';
import { orbTarget, PATTERNS, timeline, totalSeconds, type PatternKey } from '../src/features/breathe/patterns';
import { TODAY_KEY } from '../src/features/today/data';
import { withQuietRetry } from '../src/lib/http';
import { queryClient } from '../src/lib/queryClient';
import { haptics } from '../src/theme/haptics';
import { kit, screenPadding, spacing, touchTarget } from '../src/theme/tokens';

type Step = 'before' | 'pattern' | 'session' | 'after' | 'result';

function newSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Counts down one phase. Mounted fresh for each phase (keyed), so it always starts from the full length. */
function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const tick = setInterval(() => setLeft((s) => Math.max(1, s - 1)), 1000);
    return () => clearInterval(tick);
  }, []);
  return (
    <Text variant="heading" tone="muted" center>
      {left}
    </Text>
  );
}

function Session({ pattern, onFinish }: { pattern: PatternKey; onFinish: () => void }) {
  const phases = timeline(pattern);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const level = useSharedValue(0);
  const phase = phases[index];

  // Each phase: animate the orb over its length, tick once at the start, count down each second.
  useEffect(() => {
    if (!phase || paused) return undefined;
    haptics.soft();
    level.set(withTiming(orbTarget(phase.kind), { duration: phase.seconds * 1000, easing: Easing.inOut(Easing.sin) }));
    const next = setTimeout(() => {
      if (index + 1 >= phases.length) onFinish();
      else setIndex(index + 1);
    }, phase.seconds * 1000);
    return () => clearTimeout(next);
  }, [index, paused, phase, phases.length, level, onFinish]);

  // Leaving the app pauses; coming back resumes the current phase from its start.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setPaused(state !== 'active'));
    return () => sub.remove();
  }, []);

  if (!phase) return null;
  return (
    <View style={styles.session}>
      <Orb level={level} />
      <View style={styles.phase} accessibilityLiveRegion="polite">
        <Text variant="title" center>
          {paused ? 'Paused' : phase.label}
        </Text>
        {paused ? <Text variant="heading"> </Text> : <Countdown key={`phase-${index}`} seconds={phase.seconds} />}
        <Text variant="footnote" tone="muted" center>
          Round {phase.round} of 4
        </Text>
      </View>
      <Button label={paused ? 'Resume' : 'Pause'} variant="secondary" align="center" onPress={() => setPaused(!paused)} />
    </View>
  );
}

export default function Breathe() {
  const router = useRouter();
  const { palette, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('before');
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [pattern, setPattern] = useState<PatternKey>('calm');
  const [xp, setXp] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const sessionId = useRef(newSessionId());

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );

  const finishSession = useCallback(() => {
    haptics.success();
    setStep('after');
  }, []);

  const save = async () => {
    if (!after) return;
    setSaving(true);
    try {
      const meta = { sessionId: sessionId.current, pattern, seconds: totalSeconds(pattern), ...(before ? { moodBefore: before } : null), moodAfter: after };
      const [, activity] = await withQuietRetry(() =>
        Promise.all([
          authed('/checkins', { method: 'POST', body: { mood: after, source: 'post_breathe' }, schema: checkinResponseSchema }),
          authed('/activities', { method: 'POST', body: { kind: 'breathe', meta }, schema: activityResponseSchema }),
        ]),
      );
      setXp(activity.xpAwarded);
      void queryClient.invalidateQueries({ queryKey: TODAY_KEY });
    } catch {
      setXp(null); // Saved later is fine; the session still counts on screen.
    } finally {
      setSaving(false);
      setStep('result');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.top}>
        <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={spacing.sm} style={styles.close}>
          <X size={kit.icon} color={palette.muted} />
        </PressScale>
      </View>

      {step === 'before' ? (
        <Entrance style={styles.body}>
          <Text variant="title" center>
            How are you, right now?
          </Text>
          <MoodPicker value={before} onChange={setBefore} />
          <Button label="Continue" onPress={() => setStep('pattern')} disabled={!before} wide />
        </Entrance>
      ) : null}

      {step === 'pattern' ? (
        <Entrance style={styles.body}>
          <Text variant="title" center>
            Pick a rhythm
          </Text>
          <View style={styles.chips}>
            {(Object.keys(PATTERNS) as PatternKey[]).map((key) => (
              <Chip key={key} label={PATTERNS[key].name} selected={pattern === key} onPress={() => setPattern(key)} />
            ))}
          </View>
          <Text variant="callout" tone="muted" center>
            {PATTERNS[pattern].detail}, four rounds. About {Math.round(totalSeconds(pattern) / 60)} minute{totalSeconds(pattern) >= 90 ? 's' : ''}.
          </Text>
          <Button label="Start" onPress={() => setStep('session')} wide />
        </Entrance>
      ) : null}

      {step === 'session' ? <Session pattern={pattern} onFinish={finishSession} /> : null}

      {step === 'after' ? (
        <Entrance style={styles.body}>
          <Text variant="title" center>
            How do you feel now?
          </Text>
          <MoodPicker value={after} onChange={setAfter} />
          <Button label="Save" onPress={() => void save()} disabled={!after} loading={saving} wide />
        </Entrance>
      ) : null}

      {step === 'result' && after ? (
        <Entrance style={styles.body}>
          <Text variant="title" center>
            Nicely done
          </Text>
          <Card>
            <View style={styles.compare} accessible accessibilityLabel={`Before ${before ?? 'not noted'}, after ${after}`}>
              <View style={styles.side}>
                <Text variant="footnote" tone="muted">
                  Before
                </Text>
                {before ? <MoodFace mood={before} color={palette.ink} size={touchTarget} /> : null}
              </View>
              <Text variant="heading" tone="muted">
                →
              </Text>
              <View style={styles.side}>
                <Text variant="footnote" tone="muted">
                  After
                </Text>
                <MoodFace mood={after} color={palette.accent} size={touchTarget} />
              </View>
            </View>
          </Card>
          {xp ? (
            <Text variant="callout" tone="muted" center>
              +{xp} XP
            </Text>
          ) : null}
          <Button label="Done" onPress={() => router.back()} wide />
        </Entrance>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: screenPadding },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center', gap: spacing.xxl },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  session: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xxxl },
  phase: { gap: spacing.sm, alignItems: 'center' },
  compare: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  side: { alignItems: 'center', gap: spacing.sm },
});
