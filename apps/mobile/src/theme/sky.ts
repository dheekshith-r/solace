// Values for the scene behind Today (spec section 7.7). Colors are published HIG values, or tints of
// them through opacity. Sky stops are derived from HIG blue, cyan, teal, indigo and orange. The first
// two stops of each sky are identical on purpose: the date and headline sit there, and black or white
// on a single color always passes AA, including during the blends.

export type Stops = readonly [string, string, string, string];

export const skyStopPositions = [0, 0.5, 0.75, 1] as const;

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
  sleepyFrom: 1320, // 10 pm, spec section 7.4.
  sleepyUntil: 300,
} as const;

// The hidden long-press cycles these, for recording the demo.
export const demoMinutes = [360, 720, 1080, 1380] as const;

export const moodLevels = 5;
export const moodNeutral = 3;
export const moodLabels = ['Heavy', 'Low', 'Okay', 'Good', 'Bright'] as const;

export const skyColor = {
  star: '#FFFFFF',
  sun: ['#FFFFFF', '#FFCC00', 'rgba(255,141,40,0)'], // White, Yellow, Orange fading out.
  sunRadius: 30,
  moon: '#F2F2F7', // Gray 6.
  moonDark: 'rgba(242,242,247,0.1)',
  moonRadius: 16,
  cornerInsetX: 44,
  cornerInsetY: 34,
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
  shootingLength: 90,
} as const;

// Drift in points per second. Slower layers read as further away.
export const cloudLayers = [
  { band: 'sola', at: 0.5, scale: 0.6, speed: 2.2, opacity: 0.6, offset: 0.1 },
  { band: 'scene', at: 0.12, scale: 0.8, speed: 3.4, opacity: 0.85, offset: 0.55 },
  { band: 'scene', at: 0.3, scale: 1, speed: 4.8, opacity: 1, offset: 0.25 },
] as const;

export const cloudPuffs = [
  { x: -40, y: 6, r: 16 },
  { x: -18, y: -4, r: 22 },
  { x: 12, y: -8, r: 26 },
  { x: 40, y: 4, r: 17 },
  { x: 0, y: 8, r: 22 },
] as const;

// Sola: the round, glowing orange character, drawn in a 200-point box.
export const sola = {
  maxSize: 104,
  minSize: 72,
  screenRatio: 0.115,
  viewBox: 200,
  body: ['#FFE3C8', '#FFAE66', '#FF8D28'], // Orange and its tints.
  bodyStops: [0, 0.5, 1],
  cheek: '#FF383C', // Red.
  cheekOpacity: 0.5,
  ink: '#3A1E08',
  glowRatio: 1.05,
  glowDay: ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0)'],
  glowNight: ['rgba(255,146,48,0.62)', 'rgba(255,146,48,0)'], // Orange (dark) fading out.
} as const;

// Published HIG colors. Opacity keeps them soft and quiet.
export const sceneColor = {
  mountain: '#AEAEB2', // Gray 2.
  mountainFade: 'rgba(174,174,178,0)',
  snow: '#FFFFFF',
  hill: '#34C759', // Green.
  hillFarOpacity: 0.26,
  hillNearOpacity: 0.42,
  stream: '#00C3D0', // Teal.
  streamOpacity: 0.6,
  branch: '#AC7F5E', // Brown.
  blossom: '#FF2D55', // Pink.
  blossomOpacity: 0.72,
  petal: '#FF2D55',
  petalOpacity: 0.7,
  petalNightOpacity: 0.42,
  shimmer: '#FFFFFF',
  nightOverlay: '#001D33', // The night sky's own color.
  nightOverlayOpacity: 0.78,
} as const;

// Fractions of the scene, the visible strip between the headline and the sheet.
export const sceneShapes = {
  mountain: [
    [0.16, 0.74],
    [0.34, 0.5],
    [0.42, 0.56],
    [0.5, 0.3],
    [0.59, 0.54],
    [0.68, 0.46],
    [0.86, 0.74],
  ],
  snow: [
    [0.5, 0.3],
    [0.462, 0.43],
    [0.48, 0.405],
    [0.5, 0.45],
    [0.52, 0.4],
    [0.54, 0.44],
  ],
  blossoms: [
    [0.3, 0.12, 3.2],
    [0.255, 0.15, 2.6],
    [0.19, 0.17, 2.4],
    [0.24, 0.29, 2.8],
    [0.685, 0.13, 3.2],
    [0.74, 0.15, 2.6],
    [0.8, 0.17, 2.2],
    [0.77, 0.3, 2.8],
  ],
  shimmer: [
    [0.5, 0.75, 6],
    [0.485, 0.8, 8],
    [0.525, 0.84, 10],
    [0.57, 0.88, 12],
    [0.6, 0.93, 15],
    [0.56, 0.98, 18],
  ],
} as const;

export const petals = {
  count: 8,
  countLite: 4,
  fallSpeed: 11,
  swayDistance: 14,
  swaySpeed: 0.45,
  spinSpeed: 0.5,
  size: 4.5,
} as const;

export const owlVisit = { minDelay: 20, maxDelay: 90, minNight: 0.95 } as const;

// Seconds since the owl's visit began. Positions are fractions of the scene; enter starts off-screen.
export const owlTimeline = {
  glideEnd: 7,
  settleEnd: 9,
  turnEnd: 11.5,
  blinkStart: 12.2,
  blinkLength: 0.35,
  secondBlinkStart: 13.4,
  holdEnd: 15,
  turnBackEnd: 16,
  flyEnd: 26,
  fadeFrom: 23,
  enter: { x: 1.15, y: 0.15 }, // Stays below the headline for the whole flight.
  perch: { x: 0.8, y: 0.09 },
  leave: { x: 0.5, y: 0.3 },
  leaveScale: 0.2,
  wingFoldTime: 2.2,
  flapPerSecond: 0.9,
  flapDegrees: 26,
  arcLift: 0.12,
  size: 0.9,
} as const;

export const owlColor = {
  body: '#AC7F5E', // Brown.
  wing: '#956D51', // Brown, increased contrast.
  belly: '#E5E5EA', // Gray 5.
  eye: '#FFCC00', // Yellow.
  pupil: '#1C1C1E', // Gray 6 (dark).
  beak: '#FF8D28', // Orange.
} as const;
