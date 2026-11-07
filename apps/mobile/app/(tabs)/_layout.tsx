import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { TabBar, type Tab } from '../../src/components/TabBar';
import { useTheme } from '../../src/components/ThemeProvider';
import { todayChromeDarkness } from '../../src/features/today/chrome';
import { spacing } from '../../src/theme/tokens';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: readonly Tab[] = [
  { key: 'today', label: 'Today' },
  { key: 'sola', label: 'Sola' },
  { key: 'you', label: 'You' },
];

function AppTabBar({ state, navigateToTab, insets }: TabBarProps) {
  const focused = state.routes[state.index];
  const onToday = focused?.name === 'today';
  // A screen pushed inside a tab (a conversation in Sola) is full-focus: the bar slides away, and
  // comes back when the tab returns to its first screen.
  // React Navigation puts a nested stack's state on its route at runtime; the vendored type omits it.
  const nested = ((focused as { state?: { index?: number } } | undefined)?.state?.index ?? 0) > 0;
  return (
    <TabBar
      tabs={TABS}
      index={state.index}
      bottom={insets.bottom + spacing.md}
      hidden={nested}
      darkness={onToday ? todayChromeDarkness : undefined}
      onSelect={(index) => {
        const route = state.routes[index];
        if (route) navigateToTab(route.key);
      }}
    />
  );
}

/**
 * Today, Sola and You. Back from Sola or You returns to Today; back on Today leaves the app. Tabs cross-fade.
 *
 * Inactive tabs stay attached (ticket 08b). Detaching them took Today's Skia surface out of the
 * window, so every return built a new full-screen buffer (about 13 MB each, five were retained).
 * Attached and faded out, Today's canvas keeps its one surface and doesn't draw while hidden.
 */
export default function TabsLayout() {
  const { palette } = useTheme();
  return (
    <Tabs
      backBehavior="initialRoute"
      detachInactiveScreens={false}
      // No navigator fade: each tab fades itself in with TabScene, opaque and composited as one image.
      screenOptions={{ headerShown: false, animation: 'none', sceneStyle: { backgroundColor: palette.background } }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="sola" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
