// Placeholder until ticket 08 (Sola tab and conversation).
import { MessageCircle } from 'lucide-react-native';
import { Card, EmptyState, Entrance, Screen } from '../../../src/components';

export default function SolaTab() {
  return (
    <Screen title="Sola" tabs>
      <Entrance>
        <Card>
          <EmptyState icon={MessageCircle} title="Your talks with Sola" body="Conversations with Sola will live here, ready to pick up where you left off." />
        </Card>
      </Entrance>
    </Screen>
  );
}
