// Placeholder until ticket 09 (Breathe) lands later today.
import { Wind } from 'lucide-react-native';
import { Card, EmptyState, Screen } from '../src/components';

export default function Breathe() {
  return (
    <Screen title="Breathe" back>
      <Card>
        <EmptyState icon={Wind} title="Breathe" body="Guided breathing arrives with the next update." />
      </Card>
    </Screen>
  );
}