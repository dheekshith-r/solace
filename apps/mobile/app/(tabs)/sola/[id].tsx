// Placeholder until ticket 08 (the conversation screen).
import { MessageCircle } from 'lucide-react-native';
import { EmptyState, Screen } from '../../../src/components';

export default function Conversation() {
  return (
    <Screen title="Conversation" back>
      <EmptyState icon={MessageCircle} title="Conversation" body="This conversation will open here." />
    </Screen>
  );
}
