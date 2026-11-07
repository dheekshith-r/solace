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

/** Typing dots: each rises and brightens in turn, like most chat apps. */
export const typing = { half: 320, stagger: 160, rest: 0.35, lift: 4 } as const;

export const pressScale = 0.95;
export const pressScaleGentle = 0.98; // Large surfaces (cards, rows) move less than buttons.

// The collapsing header: fractions of the collapse distance, and how much the title grows on pull-down.
export const header = { barTitleFrom: 0.6, largeTitleGone: 0.7, pullGrow: 1.08 } as const;
