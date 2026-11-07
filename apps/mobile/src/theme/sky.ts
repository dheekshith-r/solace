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
  sunrise: 360,
  sunset: 1080,
  sleepyFrom: 1320, // 10 pm, spec section 7.4.
  sleepyUntil: 300,
  sleepyRamp: 8,
} as const;

// The hidden long-press cycles these, for recording the demo.
export const demoMinutes = [360, 720, 1080, 1380] as const;

export const moodLevels = 5;
export const moodNeutral = 3;
export const moodLabels = ['Heavy', 'Low', 'Okay', 'Good', 'Bright'] as const;

export const skyColor = {
  star: '#FFFFFF',
  // A full white disc with a soft white glow.
  sun: ['#FFFFFF', '#FFFFFF', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'],
  sunStops: [0, 0.2, 0.26, 0.55, 1],
  sunRadius: 84,
  moon: '#F2F2F7', // Gray 6.
  // The sun rises from the right edge, curves in and sinks back to it; the moon does the same on the
  // left. Neither ever reaches Sola. Fractions of the width.
  sunEdgeX: 1.08,
  sunReachX: 0.77,
  moonEdgeX: -0.08,
  moonReachX: 0.23,
  arcApexBelowDate: 30, // Points below the date row at the top of the arc.
  arcEndBelowSola: 0.75, // Sola sizes below Sola's center where the arc meets the screen edges.
  cloud: '#FFFFFF',
  shootingStar: '#FFFFFF',
} as const;

export const skyMotion = {
  shootingMinGap: 10,
  shootingMaxGap: 20,
  shootingDuration: 0.9,
  shootingLength: 90,
} as const;

// Drift in points per second. Each cloud is its own painted image: further is smaller, slower, fainter.
export const cloudLayers = [
  { at: 0.02, width: 170, height: 46, seed: 3.7, speed: 1.4, opacity: 0.62, offset: 0.62 },
  { at: 0.1, width: 240, height: 66, seed: 11.3, speed: 2.3, opacity: 0.8, offset: 0.12 },
  { at: 0.24, width: 300, height: 84, seed: 23.9, speed: 3.4, opacity: 0.95, offset: 0.42 },
] as const;

// A full moon's near side, as [x, y, xRadius, yRadius] in moon radii.
export const moon = {
  radius: 22,
  haloRadius: 4,
  halo: ['rgba(242,242,247,0.3)', 'rgba(242,242,247,0.09)', 'rgba(242,242,247,0)'],
  haloStops: [0.25, 0.5, 1],
} as const;

// The whole star field is one GPU shader. Fractions are of the screen height down to the horizon.
export const starField = {
  cell: 13, // One possible star per cell of this many points.
  cellLite: 20,
  milkyWay: 0.075,
} as const;

// Sola: the round, glowing orange character, drawn in a 200-point box.
export const sola = {
  maxSize: 104,
  minSize: 72,
  screenRatio: 0.115,
  viewBox: 200,
  body: ['#FFE3C8', '#FFAE66', '#FF8D28'], // Orange and its tints.
  bodyStops: [0, 0.5, 1],
  cheek: '#FF383C', // Red.
  blushLow: 0.3,
  blushHigh: 0.58,
  eyeY: 104,
  eyeLow: 0.78,
  mouthCurve: 11,
  floatDistance: 2.5,
  floatPeriod: 5,
  sceneOverlap: 0.32,
  ink: '#3A1E08',
  glowRatio: 1.05,
  glowDay: ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0)'],
  glowNight: ['rgba(255,146,48,0.62)', 'rgba(255,146,48,0)'], // Orange (dark) fading out.
} as const;

// Published HIG colors. The scene mixes these in bake.ts rather than adding any new colors.
export const sceneColor = {
  hig: {
    white: '#FFFFFF',
    gray: '#8E8E93',
    gray6: '#F2F2F7',
    grayDark: '#48484A', // Gray 3 (dark).
    blue: '#0088FF',
    green: '#34C759',
    greenDeep: '#008932', // Green, increased contrast.
    brown: '#AC7F5E',
    brownDeep: '#956D51', // Brown, increased contrast.
    pink: '#FF2D55',
    orange: '#FF8D28',
    skyDay: '#A6D3FF', // The day sky's own color.
    nightSky: '#001D33', // The night sky's own color.
  },
  mountain: '#8E8E93', // Gray.
  petalBase: '#FFFFFF',
  petalVeil: '#FF2D55', // Pink.
  petalVeilOpacity: 0.2,
  petalOpacity: 0.95,
  petalNightOpacity: 0.5,
  nightOverlay: '#001D33',
  nightOverlayOpacity: 0.78,
} as const;

// Fractions of the scene, the visible strip between Sola and the sheet.
// Fuji and the lake sit a little high so the whole stream shows above the sheet, which overlaps the
// strip's bottom ~15% (Ddk, Nov 7: the stream's mouth was hidden).
export const sceneShapes = {
  fuji: { summitY: 0.15, footY: 0.47 },
  pool: { topY: 0.47, bottomY: 0.65 },
  // The stream: one S-curve from the lake, widening as it comes toward the viewer.
  stream: {
    topY: 0.642,
    bottomY: 0.84,
    centerX: 0.5,
    bendStart: 0.008,
    bendGrowth: 0.13,
    bends: 1.15,
    widthStart: 0.012,
    widthGrowth: 0.56,
    widthPower: 1.8, // Perspective: most of the narrowing happens in the distance.
  },
} as const;

// The meadow darkens toward the viewer. Colors are HIG Green and Green (increased contrast).
export const meadow = {
  near: '#008932',
  tip: '#34C759', // Green.
  tuftCount: 18,
  tuftBlades: 7,
  tuftMinHeight: 10,
  tuftMaxHeight: 24,
  tuftSpread: 12,
  tuftBlade: 1.5,
  swayBatches: 4,
  swaySpeed: 0.7,
  swayAmount: 0.035,
  gustAmount: 0.14,
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

// How far the trees sit below the top of the scene, so they frame Fuji below its peak.
export const treeDrop = 0.21;

export const blossom = {
  radius: 3.1,
  radiusVariation: 0.32,
  clustersPerFlowerUnit: 0.42,
  flowersPerCluster: 11,
  clusterRadius: 8.5,
  twigsPerLimb: 3,
  twigMinLength: 0.045,
  twigMaxLength: 0.095,
  limbSamples: 22,
  widthWobble: 0.15,
  knotMinLimbWidth: 3.4,
  knotsPerLimb: 3,
} as const;

// Mostly still. Each gust sways the branches slightly and releases a few petals.
export const wind = {
  minGap: 15,
  maxGap: 30,
  minPetals: 1,
  maxPetals: 3,
  releaseChance: 0.45,
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
  flutterPerSecond: 0.38, // The petal turning over as it falls.
  flutterMin: 0.25,
  scale: 0.72,
  // Base at the bottom, broad middle, small notch at the tip.
  shape: 'M0 5 C-3.6 3 -4.6 -2 -2.2 -4.6 L0 -3.4 L2.2 -4.6 C4.6 -2 3.6 3 0 5 Z',
} as const;

// The stream's water shader. Tint is HIG Teal.
export const water = { tint: '#00C3D0', moonMinX: 0.42, moonMaxX: 0.74, flow: 0.42 } as const;

// Where the stream meets the lake: ripples spreading out with a little foam. Fractions of the width.
export const splash = { width: 0.34, height: 30, speed: 2.1, opacity: 0.6 } as const;

// Golden hour light on the landscape, in minutes around sunrise and sunset.
export const goldenHour = { sunriseCenter: 375, sunsetCenter: 1045, reach: 75 } as const;
