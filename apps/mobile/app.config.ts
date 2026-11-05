import type { ExpoConfig } from 'expo/config';

const SPLASH_LIGHT = '#EEF0F8';
const SPLASH_DARK = '#12111C';
const ACCENT = '#6F63E8';

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
        image: './assets/splash-icon.png',
        imageWidth: 200,
        dark: { backgroundColor: SPLASH_DARK, image: './assets/splash-icon.png' },
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
