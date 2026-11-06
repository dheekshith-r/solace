// Placeholder until ticket 12 (You tab).
import { Sparkles } from 'lucide-react-native';
import { Card, EmptyState, Entrance, Screen } from '../../src/components';

export default function YouTab() {
  return (
    <Screen title="You" tabs>
      <Entrance>
        <Card>
          <EmptyState icon={Sparkles} title="Your constellation" body="Each day you check in adds a star. Your progress and settings live here." />
        </Card>
      </Entrance>
    </Screen>
  );
}
