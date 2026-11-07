import { Stack } from 'expo-router';
import { TabScene } from '../../../src/components';

export default function SolaLayout() {
  return (
    <TabScene>
      <Stack screenOptions={{ headerShown: false }} />
    </TabScene>
  );
}
