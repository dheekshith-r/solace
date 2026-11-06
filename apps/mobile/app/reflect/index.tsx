// Placeholder until ticket 10 (Reflect).
import { Sparkles } from 'lucide-react-native';
import { Card, EmptyState, Screen } from '../../src/components';

export default function Reflect() {
  return (
    <Screen title="Reflect" back>
      <Card>
        <EmptyState icon={Sparkles} title="Reflect" body="Three friendly check-ins, not diagnoses. Coming with the next update." />
      </Card>
    </Screen>
  );
}