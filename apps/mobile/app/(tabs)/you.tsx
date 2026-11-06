// Placeholder until ticket 12 (You tab). Log out lives here for now (ticket 05).
import { useRouter } from 'expo-router';
import { Bell, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Button, Card, EmptyState, Entrance, ListGroup, ListRow, Screen, Text } from '../../src/components';
import { logOut, useSession } from '../../src/features/auth/session';

export default function YouTab() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [leaving, setLeaving] = useState(false);
  return (
    <Screen title="You" tabs>
      <Entrance index={0}>
        <Card>
          <EmptyState icon={Sparkles} title="Your constellation" body="Each day you check in adds a star. Your progress and settings live here." />
        </Card>
      </Entrance>
      <Entrance index={1}>
        <ListGroup header="Settings">
          <ListRow icon={Bell} title="Reminders" onPress={() => router.push('/settings/reminders')} />
        </ListGroup>
      </Entrance>
      {user ? (
        <Entrance index={2}>
          <Text variant="footnote" tone="muted" center>
            Signed in as {user.email}
          </Text>
          <Button
            label="Log out"
            variant="secondary"
            align="center"
            loading={leaving}
            onPress={async () => {
              setLeaving(true);
              await logOut();
              router.replace('/onboarding');
            }}
          />
        </Entrance>
      ) : null}
    </Screen>
  );
}
