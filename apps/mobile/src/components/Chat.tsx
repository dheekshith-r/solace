import { ArrowUp, Phone } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, fontSize, kit, lineHeightRatio, radius, screenPadding, spacing, touchTarget } from '../theme/tokens';
import { Button } from './Button';
import { Card } from './Card';
import { Entrance } from './Entrance';
import { PressScale } from './PressScale';
import { Text } from './Text';
import { useFill, useTheme } from './ThemeProvider';

/** One message. The user's sits right in the accent; Sola's sits left on the surface. Rises in once. */
export function ChatBubble({ role, children, footer }: { role: 'user' | 'assistant'; children: string; footer?: ReactNode }) {
  const { palette } = useTheme();
  const fill = useFill();
  const mine = role === 'user';
  return (
    <Entrance style={[styles.bubbleRow, mine ? styles.mine : styles.theirs]}>
      <View
        style={[styles.bubble, mine ? [styles.bubbleMine, { backgroundColor: palette.accent }] : [styles.bubbleTheirs, { backgroundColor: fill }]]}
        accessible
        accessibilityLabel={`${mine ? 'You' : 'Sola'}: ${children}`}
      >
        <Text variant="body" tone={mine ? 'onAccent' : 'ink'} selectable>
          {children}
        </Text>
      </View>
      {footer}
    </Entrance>
  );
}

/** Sola is thinking: three soft dots in a bubble. */
export function TypingBubble() {
  const fill = useFill();
  return (
    <Entrance style={[styles.bubbleRow, styles.theirs]}>
      <View style={[styles.bubble, styles.bubbleTheirs, { backgroundColor: fill }]} accessible accessibilityLabel="Sola is replying" testID="sola-typing">
        <Text variant="body" tone="muted">
          •••
        </Text>
      </View>
    </Entrance>
  );
}

/** Tele-MANAS, India's free mental health helpline. Shown on any crisis signal. Never hidden behind a tap. */
export function HelplineCard({ name = 'Tele-MANAS', number = '14416', hours = 'Free, 24 hours, every day', emergencyNumber = '112', onTalkToSola }: {
  name?: string;
  number?: string;
  hours?: string;
  emergencyNumber?: string;
  onTalkToSola?: () => void;
}) {
  return (
    <Card hero accessibilityLabel="Support is available">
      <Text variant="heading" accessibilityRole="header">
        You don&apos;t have to carry this alone
      </Text>
      <Text variant="callout">
        {name} is free and confidential. Call {number} ({hours}). In an emergency, call {emergencyNumber}.
      </Text>
      <Button label={`Call ${name} ${number}`} icon={Phone} onPress={() => void Linking.openURL(`tel:${number}`)} wide accessibilityHint="Opens your phone's dialer" />
      {onTalkToSola ? <Button label="Keep talking with Sola" variant="text" align="center" onPress={onTalkToSola} /> : null}
      <Text variant="footnote" tone="muted">
        Sola is not a substitute for professional help.
      </Text>
    </Card>
  );
}

/** The message box. Put it inside a KeyboardAvoidingView so it rides the keyboard; send is disabled until there is text. */
export function Composer({ onSend, disabled = false, placeholder = 'Tell Sola what is on your mind' }: { onSend: (text: string) => void; disabled?: boolean; placeholder?: string }) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !disabled;
  const send = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };
  return (
    <View style={[styles.composer, { backgroundColor: palette.background, paddingBottom: insets.bottom + spacing.sm, borderTopColor: palette.separator }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          selectionColor={palette.accent}
          cursorColor={palette.accent}
          multiline
          maxLength={kit.messageMax}
          accessibilityLabel="Message to Sola"
          testID="field-message"
          style={[styles.input, { color: palette.ink, backgroundColor: palette.surface }]}
        />
        <PressScale
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send"
          testID="button-send"
          accessibilityState={{ disabled: !canSend }}
          style={[styles.send, { backgroundColor: palette.accent, opacity: canSend ? 1 : kit.sendDisabled }]}
        >
          <ArrowUp size={kit.icon} color={palette.onAccent} strokeWidth={kit.iconStrokeBold} />
        </PressScale>
      </View>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { gap: spacing.sm, maxWidth: '86%' },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.card },
  bubbleMine: { borderBottomRightRadius: radius.petal / 2 },
  bubbleTheirs: { borderBottomLeftRadius: radius.petal / 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: touchTarget,
    maxHeight: kit.composerMax,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: font.regular,
    fontSize: fontSize.body,
    lineHeight: Math.round(fontSize.body * lineHeightRatio.body),
  },
  send: { width: touchTarget, height: touchTarget, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
