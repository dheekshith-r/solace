// The Sola tab (spec 8.1): Sola's personal line for today, then the conversation history.
import type { ConversationListItem } from '@solace/shared';
import { useRouter } from 'expo-router';
import { CloudOff, MessageCircle, Plus, Trash2 } from 'lucide-react-native';
import { Alert, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Button, Card, EmptyState, Entrance, ListGroup, ListRow, PressScale, Screen, SkeletonCard, SkeletonRow, Text, useTheme } from '../../../src/components';
import { deleteConversation, useConversations } from '../../../src/features/chat/data';
import { SolaFigure } from '../../../src/features/sola/Sola';
import { useToday } from '../../../src/features/today/data';
import { kit, radius, spacing } from '../../../src/theme/tokens';

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function confirmDelete(item: ConversationListItem) {
  Alert.alert('Delete this conversation?', 'It will be gone for good, from this phone and from Solace.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void deleteConversation(item.id) },
  ]);
}

function DeleteAction({ item }: { item: ConversationListItem }) {
  const { palette } = useTheme();
  return (
    <PressScale onPress={() => confirmDelete(item)} accessibilityRole="button" accessibilityLabel="Delete conversation" style={[styles.delete, { backgroundColor: palette.ink }]}>
      <Trash2 size={kit.icon} color={palette.background} />
    </PressScale>
  );
}

function DailyLine() {
  const { scheme } = useTheme();
  const today = useToday();
  return (
    <Card hero>
      <View style={styles.line}>
        <SolaFigure size={kit.solaInline} glow={scheme === 'dark' ? 'night' : 'day'} mood={4} />
        <View style={styles.flex}>
          {today.data ? (
            <Text variant="body">{today.data.greeting}</Text>
          ) : (
            <Text variant="body" tone="muted">
              {today.isError ? "Sola's here whenever you want to talk." : 'Sola is thinking of something to say…'}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

export default function SolaTab() {
  const router = useRouter();
  const conversations = useConversations();
  const items = conversations.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen title="Sola" tabs action={{ icon: Plus, label: 'New conversation', onPress: () => router.push('/sola/new') }}>
      <Entrance index={0}>
        <DailyLine />
      </Entrance>
      <Entrance index={1}>
        <Button label="New conversation" icon={MessageCircle} onPress={() => router.push('/sola/new')} wide />
      </Entrance>
      <Entrance index={2}>
        {conversations.isPending ? (
          <Card style={styles.flush}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        ) : conversations.isError && !items.length ? (
          <Card>
            <EmptyState icon={CloudOff} title="Couldn't reach Solace" body="Check your connection. Your conversations are safe." action={{ label: 'Try again', variant: 'secondary', onPress: () => void conversations.refetch() }} />
          </Card>
        ) : !items.length ? (
          <Card>
            <EmptyState icon={MessageCircle} title="Tell Sola what's on your mind" body="Your conversations will be kept here, ready to pick up again." />
          </Card>
        ) : (
          <ListGroup header="Conversations">
            {items.map((item) => (
              <ReanimatedSwipeable key={item.id} renderRightActions={() => <DeleteAction item={item} />} overshootRight={false} friction={2}>
                <ListRow
                  icon={MessageCircle}
                  title={item.title ?? 'New conversation'}
                  subtitle={item.preview ? `${when(item.lastMessageAt)} · ${item.preview}` : when(item.lastMessageAt)}
                  onPress={() => router.push({ pathname: '/sola/[id]', params: { id: item.id } })}
                />
              </ReanimatedSwipeable>
            ))}
          </ListGroup>
        )}
        {conversations.hasNextPage ? <Button label="Show older" variant="text" align="center" loading={conversations.isFetchingNextPage} onPress={() => void conversations.fetchNextPage()} /> : null}
        {conversations.isFetching && !conversations.isPending && !items.length ? <SkeletonCard lines={1} /> : null}
      </Entrance>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flush: { padding: 0 },
  delete: { width: kit.rowMinHeight + spacing.xxl, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.petal },
});
