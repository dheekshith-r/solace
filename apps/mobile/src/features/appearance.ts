import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '../lib/storage';
import type { ColorScheme } from '../theme/tokens';
import { skySchemeNow } from './sky/skyScheme';

export type Appearance = 'sky' | 'system' | 'light' | 'dark';

export const APPEARANCES: { value: Appearance; label: string; detail: string }[] = [
  { value: 'sky', label: 'Sky', detail: 'Light by day, dark at night, like the sky on Today' },
  { value: 'system', label: 'Follow system', detail: "Matches your phone's setting" },
  { value: 'light', label: 'Always light', detail: 'Bright everywhere except Today' },
  { value: 'dark', label: 'Always dark', detail: 'Dark everywhere except Today' },
];

/** Appearance for every screen except Today, which always follows its sky (spec 7.2). */
export const useAppearance = create<{ appearance: Appearance; setAppearance: (a: Appearance) => void }>()(
  persist((set) => ({ appearance: 'sky', setAppearance: (appearance) => set({ appearance }) }), {
    name: 'appearance',
    storage: createJSONStorage(() => zustandStorage),
  }),
);

/** Pure: which scheme an appearance gives, for the phone's scheme and the sky's. */
export function resolveScheme(appearance: Appearance, system: ColorScheme, sky: ColorScheme): ColorScheme {
  if (appearance === 'light' || appearance === 'dark') return appearance;
  return appearance === 'system' ? system : sky;
}

const SKY_CHECK_MS = 60_000;

/** The scheme to use now. In Sky mode it re-checks each minute, so it turns at dusk and dawn. */
export function useResolvedScheme(): ColorScheme {
  const appearance = useAppearance((s) => s.appearance);
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [sky, setSky] = useState<ColorScheme>(skySchemeNow);
  useEffect(() => {
    if (appearance !== 'sky') return undefined;
    const timer = setInterval(() => setSky(skySchemeNow()), SKY_CHECK_MS);
    return () => clearInterval(timer);
  }, [appearance]);
  return resolveScheme(appearance, system, sky);
}
