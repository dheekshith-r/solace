import type { ExpoConfig } from 'expo/config';

// The icon's night navy, behind the icon and the native splash in both modes (Ddk, Nov 7).
// Expo's config loader can't import src/theme, so a unit test keeps these equal to the tokens.
export const SPLASH_NIGHT = '#0B1026'; // brand.night
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
      backgroundColor: SPLASH_NIGHT,
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
        backgroundColor: SPLASH_NIGHT,
        // The app's own Sola (Sola.tsx, onboarding pose, night glow), inside the 160 dp circle Android 12+ shows.
        image: './assets/splash-icon.png',
        imageWidth: 288,
        dark: { backgroundColor: SPLASH_NIGHT, image: './assets/splash-icon.png' },
      },
    ],
    ['expo-notifications', { color: ACCENT, icon: './assets/notification-icon.png' }],
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
