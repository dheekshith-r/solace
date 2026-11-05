import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV();

export const storageKeys = {
  hasCheckedIn: 'today.hasCheckedIn',
} as const;
