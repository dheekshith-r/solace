// Native modules that unit tests can't load: use the libraries' own mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Reanimated 4.7.1 runs its native start-up under Jest, which registers a CSS event handler that its
// JS-only engine doesn't support and throws on. Tests never use CSS animations, so skip that one call.
jest.mock('react-native-reanimated/src/css/native/proxy', () => ({
  ...jest.requireActual('react-native-reanimated/src/css/native/proxy'),
  setCSSEventHandler: () => undefined,
}));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Keyboard handling is native; the library ships its own mock for tests.
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));

// Notifications are native; tests only need the calls to resolve.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

// MMKV is native; tests get an in-memory store with the same calls.
jest.mock('react-native-mmkv', () => {
  const data = new Map();
  return {
    createMMKV: () => ({
      getString: (k) => data.get(k),
      set: (k, v) => data.set(k, v),
      remove: (k) => data.delete(k),
      clearAll: () => data.clear(),
    }),
  };
});

jest.mock('@react-native-community/datetimepicker', () => ({ DateTimePickerAndroid: { open: jest.fn() } }));
