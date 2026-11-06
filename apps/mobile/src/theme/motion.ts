import { Easing, ReduceMotion } from 'react-native-reanimated';

// One shared spring and one shared easing (spec section 7.3). Both respect the system's reduce-motion setting.
export const spring = { damping: 18, stiffness: 180, mass: 1, reduceMotion: ReduceMotion.System } as const;

export const easing = Easing.bezier(0.22, 1, 0.36, 1);

export const duration = {
  entrance: 600,
  breathe: 2400,
  skyJump: 2500,
  skyTick: 1000,
  hintBob: 700,
  quick: 220, // Small state changes: focus rings, toasts leaving.
  pulse: 900, // Skeleton breathing, each way.
  toast: 2600, // How long a toast stays.
} as const;

export const entrance = { rise: 18, stagger: 80 } as const;

export const pressScale = 0.95;
