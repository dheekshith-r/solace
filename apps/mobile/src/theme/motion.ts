import { Easing } from 'react-native-reanimated';

// One shared spring and one shared easing (spec section 7.3).
export const spring = { damping: 18, stiffness: 180, mass: 1 } as const;

export const easing = Easing.bezier(0.22, 1, 0.36, 1);

export const duration = { entrance: 600, breathe: 2400, skyJump: 2500, skyTick: 1000, hintBob: 700 } as const;

export const pressScale = 0.95;
