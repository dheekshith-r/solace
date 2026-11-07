import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ThemeProvider, ToastProvider } from '../src/components';
import { persistOptions, queryClient } from '../src/lib/queryClient';
import { NotificationRouter } from '../src/features/notifications/NotificationRouter';
import { useResolvedScheme } from '../src/features/appearance';

// Keep the native splash up until fonts are ready, so the first drawn frame is the real splash.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  const scheme = useResolvedScheme();
  const onLayout = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);
  if (!loaded) return null;
  return (
    // testID: the phone tests assert this before every step, so they stop the instant Solace isn't in front.
    <GestureHandlerRootView style={styles.root} onLayout={onLayout} testID="solace-root">
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <KeyboardProvider>
        <ThemeProvider scheme={scheme}>
          <ToastProvider>
            <NotificationRouter />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ animation: 'fade' }} />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="breathe" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
              <Stack.Screen name="kit-sheet" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', contentStyle: { backgroundColor: 'transparent' } }} />
            </Stack>
          </ToastProvider>
        </ThemeProvider>
      </KeyboardProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
