// One Reflect check-in (spec 8.8): Sola asks four questions, one at a time, over the sky. Leaving at any
// point saves nothing. The result names a kind band and offers three moves; support shows when needed.
import type { Href } from 'expo-router';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { Heart, MessageCircle, Sparkles, Wind, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Entrance, HelplineCard, ListGroup, ListRow, PressScale, ProgressDashes, Text, ThemeProvider, useTheme } from '../../src/components';
import { authed } from '../../src/features/auth/session';
import { BANDS, bandOf, CHECKINS, isReflectKind, needsSupport, OPENING, scoreOf, type ReflectKind } from '../../src/features/reflect/questions';
import { SolaFigure } from '../../src/features/sola/Sola';
import { SkyBackdrop, skySchemeNow } from '../../src/features/sky/SkyBackdrop';
import { haptics } from '../../src/theme/haptics';
import { kit, screenPadding, spacing, touchTarget } from '../../src/theme/tokens';

type Move = { text: string; action: 'breathe' | 'chat' | 'checkin' | 'affirmation' | 'reflect' };

const MOVE_ROUTES: Record<Move['action'], { href: Href; icon: typeof Wind }> = {
  breathe: { href: '/breathe', icon: Wind },
  chat: { href: '/sola/new', icon: MessageCircle },
  checkin: { href: '/today', icon: Heart },
  affirmation: { href: '/today', icon: Sparkles },
  reflect: { href: '/reflect', icon: Sparkles },
};

/** Used when the API can't be reached: the result still helps, and nothing is lost. */
const FALLBACK_MOVES: Move[] = [
  { text: 'Take two minutes of slow breathing', action: 'breathe' },
  { text: 'Tell Sola what has been weighing on you', action: 'chat' },
  { text: 'Note how you are arriving today', action: 'checkin' },
];

function parseMoves(value: unknown): Move[] | null {
  const moves = (value as { moves?: unknown } | null)?.moves;
  if (!Array.isArray(moves)) return null;
  const ok = moves.filter((m): m is Move => typeof m?.text === 'string' && typeof m?.action === 'string' && m.action in MOVE_ROUTES);
  return ok.length ? ok.slice(0, 3) : null;
}

function Checkin({ kind }: { kind: ReflectKind }) {
  const router = useRouter();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const set = CHECKINS[kind];
  const [step, setStep] = useState(-1); // -1: the opening line; 0–3: questions; 4: result.
  const [answers, setAnswers] = useState<number[]>([]);
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [saving, setSaving] = useState(false);

  const answer = async (value: number) => {
    haptics.selection();
    const next = [...answers.slice(0, step), value];
    setAnswers(next);
    if (step < set.questions.length - 1) {
      setStep(step + 1);
      return;
    }
    setSaving(true);
    setStep(set.questions.length);
    try {
      const result = await authed<unknown>(`/assessments`, { method: 'POST', body: { kind, answers: next } });
      setMoves(parseMoves(result) ?? FALLBACK_MOVES);
    } catch {
      setMoves(FALLBACK_MOVES);
    } finally {
      setSaving(false);
    }
  };

  const done = step >= set.questions.length;
  const band = bandOf(scoreOf(answers));
  const support = done && needsSupport(kind, answers);

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.top}>
        {step >= 0 && !done ? <ProgressDashes count={set.questions.length} current={step} /> : <View />}
        <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Leave without saving" hitSlop={spacing.sm} style={styles.close}>
          <X size={kit.icon} color={useTheme().palette.muted} />
        </PressScale>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <SolaFigure size={kit.solaInline + spacing.xxl} glow={scheme === 'dark' ? 'night' : 'day'} mood={done && band === 'strained' ? 3 : 4} />

        {step === -1 ? (
          <Entrance style={styles.block}>
            <Text variant="title" center>
              {set.title}
            </Text>
            <Text variant="body" center>
              {OPENING}
            </Text>
            <Text variant="callout" tone="muted" center>
              {set.intro}
            </Text>
            <Button label="Begin" onPress={() => setStep(0)} wide />
          </Entrance>
        ) : null}

        {step >= 0 && !done ? (
          <Entrance key={step} style={styles.block}>
            <Text variant="title" center accessibilityRole="header">
              {set.questions[step]}
            </Text>
            <ListGroup>
              {set.answers.map((label, value) => (
                <ListRow key={label} title={label} trailing={{ kind: answers[step] === value ? 'value' : 'none', value: '✓' } as never} onPress={() => void answer(value)} />
              ))}
            </ListGroup>
            {step > 0 ? <Button label="Back" variant="text" align="center" onPress={() => setStep(step - 1)} /> : null}
          </Entrance>
        ) : null}

        {done ? (
          <Entrance style={styles.block}>
            <Text variant="title" center accessibilityRole="header">
              {BANDS[band].name}
            </Text>
            <Text variant="body" center>
              {BANDS[band].message}
            </Text>
            {support ? (
              <>
                <Text variant="heading" center>
                  Want to talk to someone right now?
                </Text>
                <HelplineCard onTalkToSola={() => router.push('/sola/new')} />
              </>
            ) : null}
            <Card>
              <Text variant="footnoteStrong" tone="muted">
                A FEW GENTLE MOVES
              </Text>
              {saving || !moves ? (
                <Text variant="callout" tone="muted">
                  Sola is thinking about what might help…
                </Text>
              ) : (
                moves.map((m) => (
                  <Button key={m.text} label={m.text} icon={MOVE_ROUTES[m.action].icon} variant="secondary" onPress={() => router.push(MOVE_ROUTES[m.action].href)} wide />
                ))
              )}
            </Card>
            <Text variant="footnote" tone="muted" center>
              This is a friendly check-in, not a diagnosis. Not a substitute for professional help.
            </Text>
            <Button label="Done" variant="text" align="center" onPress={() => router.back()} />
          </Entrance>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function ReflectCheckin() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const [scheme] = useState(skySchemeNow);
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );
  if (!isReflectKind(kind)) return null;
  return (
    <ThemeProvider scheme={scheme}>
      <SkyBackdrop />
      <Checkin kind={kind} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: screenPadding, minHeight: touchTarget },
  close: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: screenPadding, alignItems: 'center', gap: spacing.xl, paddingTop: spacing.lg },
  block: { alignSelf: 'stretch', gap: spacing.lg },
});
