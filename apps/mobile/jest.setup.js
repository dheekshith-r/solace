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
