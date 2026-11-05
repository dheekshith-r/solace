// Values for the living sky (spec section 7.7). Sky colors are derived from HIG blue, cyan, teal,
// indigo and orange. The first two stops of each sky are identical on purpose: the headline sits
// there, and black or white on a single color always passes AA, including during the blends.

export type Stops = readonly [string, string, string, string];

export const skyStopPositions = [0, 0.38, 0.7, 1] as const;

export const skyKeyframes = {
  night: ['#0D0F1F', '#0D0F1F', '#001D33', '#002E52'],
  dawn: ['#8FBDF0', '#8FBDF0', '#F6D9C6', '#FFD9AE'],
  day: ['#A6D3FF', '#A6D3FF', '#DDF5F6', '#F2F2F7'],
  dusk: ['#0A2A5C', '#0A2A5C', '#4A6A94', '#F2A65E'],
} as const satisfies Record<string, Stops>;

// Minutes after midnight. Each blend takes 30 minutes.
export const skyTimes = {
  dawnStart: 330,
  dawn: 360,
  dayStart: 390,
  duskStart: 1050,
  dusk: 1080,
  nightStart: 1110,
  sunrise: 360,
  sunset: 1080,
  sleepyFrom: 1320, // 10 pm, spec section 7.4.
  sleepyUntil: 300,
} as const;

// The hidden long-press cycles these, for recording the demo.
export const demoMinutes = [360, 720, 1080, 1380] as const;

export const moodLevels = 5;
export const moodNeutral = 3;
export const moodDimPerLevel = 0.07;
export const moodBrightPerLevel = 0.05;
export const moodLabels = ['Heavy', 'Low', 'Okay', 'Good', 'Bright'] as const;

// Fractions of the screen. Nothing moves behind the headline, above skyContentTop.
export const skyLayout = {
  contentTop: 0.27,
  horizon: 0.64,
  arcApex: 0.3,
  arcLeft: 0.12,
  arcRight: 0.72,
  levelTop: 0.32,
  levelBottom: 0.58,
  solaX: 0.42,
} as const;

export const skyColor = {
  star: '#FFFFFF',
  sun: ['#FFFFFF', '#FFCC00', 'rgba(255,141,40,0)'], // White, Yellow, Orange fading out.
  sunRadius: 46,
  moon: '#F2F2F7',
  moonDark: 'rgba(242,242,247,0.1)',
  moonRadius: 20,
  cloud: '#FFFFFF',
  cloudDayOpacity: 0.72,
  cloudNightOpacity: 0.09,
  shootingStar: '#FFFFFF',
} as const;

export const skyMotion = {
  starCount: 34,
  starCountLite: 18,
  starMinPeriod: 4,
  starMaxPeriod: 9,
  starMinRadius: 0.7,
  starMaxRadius: 1.6,
  shootingMinGap: 10,
  shootingMaxGap: 20,
  shootingDuration: 0.9,
  shootingLength: 110,
  drizzleSpeed: 26,
} as const;

// Drift in points per second. Slower layers read as further away.
export const cloudLayers = [
  { y: 0.31, scale: 0.7, speed: 2.2, opacity: 0.6, offset: 0.1 },
  { y: 0.43, scale: 1, speed: 3.6, opacity: 0.8, offset: 0.55 },
  { y: 0.56, scale: 1.35, speed: 5.4, opacity: 1, offset: 0.25 },
] as const;

export const cloudPuffs = [
  { x: -40, y: 6, r: 16 },
  { x: -18, y: -4, r: 22 },
  { x: 12, y: -8, r: 26 },
  { x: 40, y: 4, r: 17 },
  { x: 0, y: 8, r: 22 },
] as const;

// Sola: offsets in points from Sola's center.
export const sola = {
  hitSize: 132,
  bubbleOffset: 64,
  floatDistance: 3,
  floatPeriod: 4,
  puffs: [
    { x: -36, y: 8, r: 21 },
    { x: -14, y: -14, r: 27 },
    { x: 18, y: -12, r: 25 },
    { x: 39, y: 9, r: 19 },
    { x: 0, y: 12, r: 28 },
  ],
  heavyShrink: 0.14,
  heavySag: 6,
  rimScale: 1.05,
  glowRadius: 92,
  bright: ['#FFFFFF', '#F2F2F7'],
  heavy: ['#AEAEB2', '#8E8E93'], // Gray 2, Gray.
  silver: '#D1D1D6',
  glow: ['rgba(209,209,214,0.42)', 'rgba(209,209,214,0)'],
  ink: '#1C1C1E',
  cheek: '#FF8D28',
  cheekOpacity: 0.34,
  drizzle: '#1E6EF4', // Blue, increased contrast.
} as const;

// Fractions of the screen. One star per check-in day, joined through the week.
export const constellation = [
  { x: 0.08, y: 0.33 },
  { x: 0.16, y: 0.285 },
  { x: 0.25, y: 0.31 },
  { x: 0.33, y: 0.275 },
  { x: 0.44, y: 0.295 },
  { x: 0.54, y: 0.27 },
  { x: 0.63, y: 0.3 },
] as const;
