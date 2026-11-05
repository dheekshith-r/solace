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
  // Clear sky to the right of Sola, between the date row and the headline.
  bodyX: 0.84,
  bodyBelowSola: 8,
  cloud: '#FFFFFF',
  cloudDayOpacity: 0.72,
  cloudNightOpacity: 0.06,
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
  { at: 0.1, scale: 0.6, speed: 2.2, opacity: 0.6, offset: 0.1 },
  { at: 0.2, scale: 0.8, speed: 3.4, opacity: 0.85, offset: 0.55 },
  { at: 0.34, scale: 1, speed: 4.8, opacity: 1, offset: 0.25 },
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
  mountain: '#8E8E93', // Gray.
  mountainFade: 'rgba(142,142,147,0.25)',
  mountainBlue: 'rgba(0,136,255,0.26)', // Blue, for atmospheric haze.
  mountainBlueFade: 'rgba(0,136,255,0.06)',
  snow: '#FFFFFF',
  snowShadow: '#8E8E93',
  snowShadowOpacity: 0.14,
  snowNightOpacity: 0.3, // The snow keeps a little moonlight.
  reflectionOpacity: 0.22,
  pool: '#0088FF', // Blue.
  poolOpacity: 0.22,
  hill: '#34C759', // Green.
  hillFarOpacity: 0.26,
  hillNearOpacity: 0.42,
  stream: '#00C3D0', // Teal.
  streamOpacity: 0.6,
  branch: '#956D51', // Brown, increased contrast.
  // Soft pink: white, with a veil of HIG Pink over it. The center is Pink itself.
  flowerBase: '#FFFFFF',
  flowerBaseOpacity: 0.96,
  flowerVeil: '#FF2D55', // Pink.
  flowerVeilOpacity: 0.26,
  flowerCenterOpacity: 0.75,
  flowerNightOverlayOpacity: 0.48, // Blossoms hold more light at night than the wood does.
  petalBase: '#FFFFFF',
  petalVeil: '#FF2D55',
  petalVeilOpacity: 0.26,
  petalOpacity: 0.95,
  petalNightOpacity: 0.5,
  shimmer: '#FFFFFF',
  nightOverlay: '#001D33', // The night sky's own color.
  nightOverlayOpacity: 0.78,
} as const;

// Fractions of the scene, the visible strip between the headline and the sheet.
export const sceneShapes = {
  // Mount Fuji: a broad cone with a flat summit. Each slope curves out from summit to foot.
  fuji: {
    summitLeft: 0.462,
    summitRight: 0.538,
    summitY: 0.14,
    summitDip: 0.012,
    footLeft: 0,
    footRight: 1,
    footY: 0.61,
    // Bezier handles for the left slope, mirrored for the right.
    slope: [
      [0.385, 0.25],
      [0.215, 0.53],
    ],
  },
  // The snow line, left to right: jagged tongues running down the slopes.
  snowLine: [
    [0.3, 0.33],
    [0.325, 0.3],
    [0.338, 0.335],
    [0.352, 0.31],
    [0.372, 0.395],
    [0.388, 0.325],
    [0.402, 0.35],
    [0.418, 0.32],
    [0.438, 0.43],
    [0.452, 0.335],
    [0.468, 0.365],
    [0.482, 0.325],
    [0.5, 0.385],
    [0.518, 0.33],
    [0.536, 0.47],
    [0.552, 0.34],
    [0.57, 0.375],
    [0.585, 0.32],
    [0.606, 0.405],
    [0.622, 0.315],
    [0.64, 0.345],
    [0.66, 0.305],
    [0.7, 0.33],
  ],
  // Faint gullies fanning out from the summit, as [topX, topY, bottomX, bottomY].
  snowShadows: [
    [0.478, 0.17, 0.43, 0.3],
    [0.5, 0.17, 0.495, 0.33],
    [0.522, 0.17, 0.565, 0.3],
    [0.54, 0.2, 0.61, 0.29],
  ],
  // The water at Fuji's foot, and how far the reflection is squashed to fit it.
  pool: { left: 0.16, right: 0.84, topY: 0.61, bottomY: 0.675, reflectionScale: 0.13 },
  // The stream: one S-curve from the water at Fuji's foot, widening as it comes toward the viewer.
  stream: {
    topY: 0.668,
    bottomY: 0.92,
    centerX: 0.5,
    bendStart: 0.015,
    bendGrowth: 0.13,
    bends: 1.35,
    widthStart: 0.022,
    widthGrowth: 0.2,
    samples: 28,
  },
} as const;

export const streamShimmer = {
  count: 10,
  speed: 0.045, // Fraction of the stream per second.
  lengthRatio: 0.34,
  minLength: 3,
  peakOpacity: 0.6,
} as const;

export type Limb = {
  points: readonly [readonly number[], readonly number[], readonly number[], readonly number[]];
  from: number; // Width at the base, in points.
  to: number; // Width at the tip, in points.
  flowers: number;
};

// Trees overhanging from the corners of the view: curved limbs as fractions of the scene. Each fork
// starts on its parent, and every limb tapers to its tip. The middle stays clear for Fuji's summit.
export const trees: { left: readonly Limb[]; right: readonly Limb[] } = {
  left: [
    { points: [[0, 0.01], [0.1, 0.03], [0.2, 0.1], [0.34, 0.13]], from: 11, to: 1.6, flowers: 15 },
    { points: [[0.11, 0.04], [0.15, 0.13], [0.135, 0.21], [0.2, 0.32]], from: 5, to: 1, flowers: 12 },
    { points: [[0.2, 0.1], [0.24, 0.1], [0.29, 0.07], [0.37, 0.05]], from: 3.6, to: 0.8, flowers: 9 },
    { points: [[0.14, 0.17], [0.1, 0.22], [0.07, 0.27], [0.055, 0.35]], from: 2.8, to: 0.7, flowers: 9 },
    { points: [[0.035, 0.015], [0.04, 0.09], [0.02, 0.15], [0.03, 0.24]], from: 4.2, to: 0.8, flowers: 8 },
  ],
  right: [
    { points: [[1, 0.0], [0.9, 0.05], [0.8, 0.12], [0.65, 0.11]], from: 12, to: 1.6, flowers: 15 },
    { points: [[0.88, 0.06], [0.85, 0.15], [0.87, 0.23], [0.8, 0.34]], from: 5.4, to: 1, flowers: 12 },
    { points: [[0.79, 0.12], [0.75, 0.15], [0.71, 0.21], [0.66, 0.24]], from: 3.4, to: 0.8, flowers: 9 },
    { points: [[0.86, 0.18], [0.91, 0.24], [0.94, 0.3], [0.955, 0.37]], from: 2.8, to: 0.7, flowers: 8 },
    { points: [[0.96, 0.02], [0.955, 0.07], [0.98, 0.12], [0.97, 0.19]], from: 4, to: 0.8, flowers: 7 },
  ],
};

export const blossom = {
  radius: 4.2,
  petalOffset: 0.6,
  petalRadius: 0.58,
  centerRadius: 0.26,
  scatter: 8,
  density: 1.6,
  limbSamples: 14,
} as const;

// Mostly still. Each gust sways the branches slightly and releases a few petals.
export const wind = {
  minGap: 15,
  maxGap: 30,
  minPetals: 2,
  maxPetals: 5,
  swayLength: 4,
  swayPeriod: 1.7,
  swayRadians: 0.009,
} as const;

export const fallingPetal = {
  life: 13,
  fadeIn: 0.4,
  fadeOutShare: 0.28,
  swayDistance: 15,
  swayPerSecond: 0.16,
  drift: 22,
  spinPerSecond: 0.55,
  scale: 0.72,
  // Base at the bottom, broad middle, small notch at the tip.
  shape: 'M0 5 C-3.6 3 -4.6 -2 -2.2 -4.6 L0 -3.4 L2.2 -4.6 C4.6 -2 3.6 3 0 5 Z',
} as const;

