// The You tab (spec 8.1, 8.9): your constellation, mood trend, streak and level, and doors to everything else.
import { useRouter } from 'expo-router';
import { Bell, BookOpen, CloudOff, LogOut, Moon, Shield, Sparkles, Wind } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Constellation, EmptyState, Entrance, ListGroup, ListRow, MoodTrend, Screen, SkeletonCard, Text } from '../../src/components';
import { APPEARANCES, useAppearance } from '../../src/features/appearance';
import { logOut, useSession } from '../../src/features/auth/session';
import { constellation, moodTrend, useCheckins, useMe } from '../../src/features/you/data';
import { spacing } from '../../src/theme/tokens';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="title">{value}</Text>
      <Text variant="footnote" tone="muted">
        {label}
      </Text>
    </View>
  );
}

export default function YouTab() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const me = useMe();
  const checkins = useCheckins();
  const appearance = useAppearance((s) => s.appearance);
  const [leaving, setLeaving] = useState(false);
  const tz = user?.timezone ?? 'UTC';
  const items = checkins.data?.items ?? [];
  const stats = me.data?.stats;

  return (
    <Screen title="You" tabs>
      <Entrance index={0}>
        {checkins.isPending ? (
          <SkeletonCard lines={3} />
        ) : checkins.isError && !items.length ? (
          <Card>
            <EmptyState icon={CloudOff} title="Couldn't load your stars" body="Check your connection. Nothing is lost." action={{ label: 'Try again', variant: 'secondary', onPress: () => void checkins.refetch() }} />
          </Card>
        ) : (
          <Card hero>
            <Text variant="heading">Your constellation</Text>
            <Text variant="footnote" tone="muted">
              {items.length ? 'Each day you check in adds a star.' : 'Your first mood check-in on Today lights your first star.'}
            </Text>
            <Constellation days={constellation(items, tz)} />
          </Card>
        )}
      </Entrance>

      <Entrance index={1}>
        <Card>
          <View style={styles.stats}>
            <Stat value={stats ? String(stats.streak) : '–'} label="day streak" />
            <Stat value={stats ? String(stats.level) : '–'} label="level" />
            <Stat value={stats ? String(stats.xp) : '–'} label="XP" />
          </View>
          {stats ? (
            <Text variant="footnote" tone="muted">
              {stats.xpToNext} XP to level {stats.level + 1}
            </Text>
          ) : null}
        </Card>
      </Entrance>

      <Entrance index={2}>
        <Card>
          <Text variant="heading">Two weeks of mood</Text>
          <MoodTrend points={moodTrend(items, tz)} />
        </Card>
      </Entrance>

      <Entrance index={3}>
        <ListGroup header="For you">
          <ListRow icon={Wind} title="Breathe" subtitle="Calm, Box or Sleep, about a minute" onPress={() => router.push('/breathe')} />
          <ListRow icon={Sparkles} title="Reflect" subtitle="Three friendly check-ins" onPress={() => router.push('/reflect')} />
          <ListRow icon={BookOpen} title="Resources" subtitle="Short guides and getting help" onPress={() => router.push('/resources')} />
        </ListGroup>
      </Entrance>

      <Entrance index={4}>
        <ListGroup header="Settings">
          <ListRow icon={Bell} title="Reminders" onPress={() => router.push('/settings/reminders')} />
          <ListRow icon={Shield} title="Privacy and data" onPress={() => router.push('/settings/privacy')} />
          <ListRow icon={Moon} title="Appearance" trailing={{ kind: 'value', value: APPEARANCES.find((a) => a.value === appearance)?.label ?? 'Sky' }} onPress={() => router.push('/settings/appearance')} />
          <ListRow
            icon={LogOut}
            title={leaving ? 'Logging out…' : 'Log out'}
            subtitle={user?.email}
            trailing={{ kind: 'none' }}
            onPress={async () => {
              if (leaving) return;
              setLeaving(true);
              await logOut();
              router.replace('/onboarding');
            }}
          />
        </ListGroup>
      </Entrance>
      {!user ? <Button label="Sign in" onPress={() => router.replace('/log-in')} wide /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: spacing.xs },
});
