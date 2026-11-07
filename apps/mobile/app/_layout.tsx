import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { colors } from '../src/theme/tokens';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ThemeProvider, ToastProvider } from '../src/components';
import { persistOptions, queryClient } from '../src/lib/queryClient';
import { NotificationRouter } from '../src/features/notifications/NotificationRouter';
import { useResolvedScheme } from '../src/features/appearance';

// The native splash stays up until app/index.tsx has opened the first screen, then fades.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

export default function RootLayout() {
  const [loaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  const scheme = useResolvedScheme();
  const background = colors[scheme].background;
  // The native window shows through during any transition: keep it the theme's background, not white.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(background);
  }, [background]);
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background, card: background } };
  }, [scheme, background]);
  if (!loaded) return null;
  return (
    // testID: the phone tests assert this before every step, so they stop the instant Solace isn't in front.
    <GestureHandlerRootView style={styles.root} testID="solace-root">
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <KeyboardProvider>
        <ThemeProvider scheme={scheme}>
          <NavThemeProvider value={navTheme}>
          <ToastProvider>
            <NotificationRouter />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
              <Stack.Screen name="index" options={{ animation: 'fade' }} />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="breathe" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
              <Stack.Screen name="kit-sheet" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', contentStyle: { backgroundColor: 'transparent' } }} />
            </Stack>
          </ToastProvider>
          </NavThemeProvider>
        </ThemeProvider>
      </KeyboardProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
