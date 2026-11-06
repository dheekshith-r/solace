import { Redirect } from 'expo-router';

// Entry point. Goes straight to Today for now; ticket 05 adds the auth gate (onboarding or Today).
export default function Index() {
  return <Redirect href="/today" />;
}
