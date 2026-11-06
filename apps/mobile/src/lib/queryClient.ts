import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { storage } from './storage';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Server data for every screen. Cached on the phone (MMKV), so screens open instantly, even offline. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: DAY_MS, retry: 1 },
  },
});

export const queryPersister = createAsyncStoragePersister({
  key: 'query-cache',
  storage: {
    getItem: async (key) => storage.getString(key) ?? null,
    setItem: async (key, value) => storage.set(key, value),
    removeItem: async (key) => {
      storage.remove(key);
    },
  },
});

export const persistOptions = { persister: queryPersister, maxAge: DAY_MS };
