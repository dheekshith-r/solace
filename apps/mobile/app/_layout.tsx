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
import { ThemeProvider, ToastProvider } from '../src/components';

// Keep the native splash up until fonts are ready, so the first drawn frame is the real splash.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  const onLayout = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayout}>
      <KeyboardProvider>
        <ThemeProvider>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ animation: 'fade' }} />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="kit-sheet" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', contentStyle: { backgroundColor: 'transparent' } }} />
            </Stack>
          </ToastProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
