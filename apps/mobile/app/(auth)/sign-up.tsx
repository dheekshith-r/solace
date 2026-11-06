// Placeholder until ticket 05 (sign up connected to the API).
import { useRouter } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { Button, Card, EmptyState, Screen } from '../../src/components';

export default function SignUp() {
  const router = useRouter();
  return (
    <Screen title="Create your account">
      <Card>
        <EmptyState icon={UserRound} title="Almost there" body="Account creation arrives with the next update. Your goal and reminders are saved on this phone." />
      </Card>
      <Button label="Continue to Today" variant="secondary" onPress={() => router.replace('/today')} wide />
    </Screen>
  );
}
