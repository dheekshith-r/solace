import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { TabBar, type Tab } from '../../src/components/TabBar';
import { todayChromeDarkness } from '../../src/features/today/chrome';
import { spacing } from '../../src/theme/tokens';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: readonly Tab[] = [
  { key: 'today', label: 'Today' },
  { key: 'sola', label: 'Sola' },
  { key: 'you', label: 'You' },
];

function AppTabBar({ state, navigateToTab, insets }: TabBarProps) {
  const onToday = state.routes[state.index]?.name === 'today';
  return (
    <TabBar
      tabs={TABS}
      index={state.index}
      bottom={insets.bottom + spacing.md}
      darkness={onToday ? todayChromeDarkness : undefined}
      onSelect={(index) => {
        const route = state.routes[index];
        if (route) navigateToTab(route.key);
      }}
    />
  );
}

/**
 * Today, Sola and You. Back from Sola or You returns to Today; back on Today leaves the app.
 * Tab switches are instant, like iOS: a fade turned each screen into a retained full-screen GPU layer
 * (about 13 MB each). The lit pill's slide and each page's own entrance carry the motion.
 */
export default function TabsLayout() {
  return (
    <Tabs backBehavior="initialRoute" screenOptions={{ headerShown: false, animation: 'none' }} tabBar={(props) => <AppTabBar {...props} />}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="sola" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
