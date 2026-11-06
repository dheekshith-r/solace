import type { ExpoConfig } from 'expo/config';

// Native splash and notification colors: the HIG tokens (spec 7.2), so the hand-off to the animated splash
// is seamless. Expo's config loader can't import src/theme, so a unit test keeps these equal to the tokens.
export const SPLASH_LIGHT = '#F2F2F7'; // colors.light.background
export const SPLASH_DARK = '#000000'; // colors.dark.background
export const ACCENT = '#1E6EF4'; // colors.light.accent

// Native build paths exceed Windows' 260-character limit, and the default CMake's Ninja cannot
// handle that. Windows only: Linux build servers do not have this CMake version installed.
const WINDOWS_CMAKE = process.platform === 'win32' ? { cmakeVersion: '3.31.6' } : {};

const config: ExpoConfig = {
  name: 'Solace',
  slug: 'solace',
  scheme: 'solace',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  android: {
    package: 'com.ddk.solace',
    adaptiveIcon: {
      backgroundColor: SPLASH_LIGHT,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-image',
    'expo-secure-store',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: SPLASH_LIGHT,
        // Sola, captured from the app's own art (app/kit-sola.tsx), padded so Sola and its whole glow sit in the
        // middle 2/3 that Android 12+ shows (it clips the outer third).
        image: './assets/splash-icon.png',
        imageWidth: 288,
        dark: { backgroundColor: SPLASH_DARK, image: './assets/splash-icon-dark.png' },
      },
    ],
    ['expo-notifications', { color: ACCENT }],
    [
      'expo-build-properties',
      {
        android: {
          buildArchs: ['arm64-v8a'],
          ...WINDOWS_CMAKE,
        },
      },
    ],
  ],
  experiments: { typedRoutes: true },
};

export default config;
