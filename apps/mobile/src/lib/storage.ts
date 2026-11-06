import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/** Fast on-device storage for preferences, onboarding progress and caches. Never secrets (SecureStore). */
export const storage = createMMKV({ id: 'solace' });

/** Lets zustand's persist middleware read and write MMKV synchronously. */
export const zustandStorage: StateStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => {
    storage.remove(key);
  },
};
