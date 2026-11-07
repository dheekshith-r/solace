// A conversation with Sola (spec 2.1, 8.6): replies stream in, suggestions open activities, and any
// crisis signal shows the Tele-MANAS card. Route "new" creates the conversation on the first message.
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2, Wind, Sparkles, Heart } from 'lucide-react-native';
import { useCallback, useEffect, useReducer, useRef, useState, type ComponentRef } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { Button, Card, ChatBubble, Chip, Composer, Header, HelplineCard, SkeletonCard, Text, TypingBubble, useTheme } from '../../../src/components';
import { createConversation, deleteConversation, messagesKey, sendMessage, useMessages, type StreamHandlers } from '../../../src/features/chat/data';
import { threadReducer, type ThreadItem } from '../../../src/features/chat/thread';
import { SolaFigure } from '../../../src/features/sola/Sola';
import { queryClient } from '../../../src/lib/queryClient';
import { haptics } from '../../../src/theme/haptics';
import { kit, screenPadding, spacing } from '../../../src/theme/tokens';
import { ROOT_ID } from '../../../src/components/testId';

const STARTERS = ["I'm feeling anxious", "I can't sleep", 'Today was good', 'I just need to vent'];

const SUGGESTION: Record<string, { text: string; label: string; href: Href; icon: typeof Wind } | undefined> = {
  breathe: { text: 'A few slow breaths could help right now.', label: 'Start breathing', href: '/breathe', icon: Wind },
  reflect: { text: 'A short, friendly check-in might help you see things clearly.', label: 'Open Reflect', href: '/reflect', icon: Sparkles },
  checkin: { text: 'Want to note how you are arriving today?', label: 'Mood check-in', href: '/today', icon: Heart },
  affirmation: { text: "Here's something kind to hold onto today.", label: "See today's affirmation", href: '/today', icon: Sparkles },
};

function Suggestion({ action }: { action: string | null | undefined }) {
  const router = useRouter();
  const s = action ? SUGGESTION[action] : undefined;
  if (!s) return null;
  return (
    <Card>
      <Text variant="callout">{s.text}</Text>
      <Button label={s.label} icon={s.icon} variant="secondary" onPress={() => router.push(s.href)} />
    </Card>
  );
}

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { palette, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [id, setId] = useState(params.id === 'new' ? '' : params.id);
  const messages = useMessages(id);
  const [items, dispatch] = useReducer(threadReducer, [] as ThreadItem[]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<(() => void) | null>(null);
  const sent = useRef(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollY = useSharedValue(0);

  useEffect(() => {
    if (messages.data) dispatch({ type: 'load', messages: messages.data.items });
  }, [messages.data]);
  useEffect(() => () => abort.current?.(), []);

  const handlers = useCallback(
    (conversationId: string): StreamHandlers => ({
      onDelta: (text) => dispatch({ type: 'delta', text }),
      onMeta: (meta) => dispatch({ type: 'meta', suggestedAction: meta.suggestedAction }),
      onCrisis: (helpline, replace) => dispatch({ type: 'crisis', helpline, replace }),
      onDone: (messageId) => {
        dispatch({ type: 'done', messageId });
        setBusy(false);
        void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
      },
      onError: async (message) => {
        // The user message is already saved. Find its id so "Try again" answers it without saving it twice.
        await queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
        const saved = queryClient.getQueryData<{ items: { id: string; role: string }[] }>(messagesKey(conversationId));
        const lastUser = [...(saved?.items ?? [])].reverse().find((m) => m.role === 'user');
        dispatch({ type: 'error', message, userMessageId: lastUser?.id });
        setBusy(false);
      },
    }),
    [],
  );

  const send = async (text: string) => {
    if (busy) return;
    setBusy(true);
    sent.current += 1;
    dispatch({ type: 'send', key: `local-${sent.current}`, text });
    let conversationId = id;
    try {
      if (!conversationId) {
        conversationId = await createConversation();
        setId(conversationId);
        router.setParams({ id: conversationId });
      }
      abort.current = sendMessage(conversationId, { text }, handlers(conversationId));
    } catch {
      dispatch({ type: 'error', message: "Couldn't reach Solace. Check your connection and try again." });
      setBusy(false);
    }
  };

  const retry = () => {
    const failed = items.find((i) => i.status === 'error' && i.role === 'user');
    if (!failed || !id) return;
    setBusy(true);
    dispatch({ type: 'retry' });
    abort.current = sendMessage(id, failed.id ? { text: failed.text, retryOf: failed.id } : { text: failed.text }, handlers(id));
  };

  const remove = () =>
    Alert.alert('Delete this conversation?', 'It will be gone for good, from this phone and from Solace.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (id) await deleteConversation(id);
          router.back();
        },
      },
    ]);

  // A new conversation has no id yet, so its query never runs and stays "pending": it is empty, not loading.
  const empty = !items.length && (!id || !messages.isPending);
  const loading = Boolean(id) && messages.isPending && !items.length;
  const showHelpline = items.some((i) => i.helpline);

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]} testID={ROOT_ID} collapsable={false}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={[styles.thread, { paddingTop: insets.top + kit.headerBar + spacing.md }]}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => scrollY.set(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
        >
          {loading ? <SkeletonCard lines={4} /> : null}
          {empty ? (
            <View style={styles.empty}>
              <SolaFigure size={kit.heroSola} glow={scheme === 'dark' ? 'night' : 'day'} mood={4} />
              <Text variant="heading" center>
                What&apos;s on your mind?
              </Text>
              <Text variant="callout" tone="muted" center>
                Say it however it comes out. Sola listens first.
              </Text>
              <View style={styles.chips}>
                {STARTERS.map((s) => (
                  <Chip key={s} label={s} onPress={() => void send(s)} />
                ))}
              </View>
            </View>
          ) : null}
          {items.map((item) =>
            item.role === 'assistant' && item.status === 'streaming' && !item.text ? (
              <TypingBubble key={item.key} />
            ) : (
              <View key={item.key} style={styles.item}>
                {item.text ? <ChatBubble role={item.role}>{item.text}</ChatBubble> : null}
                {item.role === 'assistant' && item.status === 'done' && !item.helpline ? <Suggestion action={item.suggestedAction} /> : null}
                {item.status === 'error' && item.role === 'user' ? (
                  <View style={styles.errorRow} accessibilityLiveRegion="polite">
                    <Text variant="footnote" tone="muted" style={styles.flex}>
                      {item.error ?? "Sola couldn't reply."} Your message is saved.
                    </Text>
                    <Button label="Try again" variant="text" onPress={retry} />
                  </View>
                ) : null}
              </View>
            ),
          )}
          {showHelpline ? (
            <HelplineCard
              onTalkToSola={() => {
                haptics.light();
                scroll.current?.scrollToEnd({ animated: true });
              }}
            />
          ) : null}
        </ScrollView>
        <Composer onSend={(text) => void send(text)} disabled={busy} />
      </KeyboardAvoidingView>
      <Header title="Sola" scrollY={scrollY} back action={id ? { icon: Trash2, label: 'Delete conversation', onPress: remove } : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  thread: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl, gap: spacing.md },
  item: { gap: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-end', maxWidth: '86%' },
});
