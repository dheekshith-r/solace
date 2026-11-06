// Placeholder until ticket 05 (log in connected to the API).
import { useRouter } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import { Button, Card, EmptyState, Screen } from '../../src/components';

export default function LogInScreen() {
  const router = useRouter();
  return (
    <Screen title="Welcome back">
      <Card>
        <EmptyState icon={LogIn} title="Log in" body="Logging in arrives with the next update." />
      </Card>
      <Button label="Continue to Today" variant="secondary" onPress={() => router.replace('/today')} wide />
    </Screen>
  );
}
