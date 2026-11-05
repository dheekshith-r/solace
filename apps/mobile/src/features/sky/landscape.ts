// Scene shapes and the owl's flight. Pure, so tests can check them without drawing.

import { blossom, fallingPetal, sceneShapes, streamShimmer, wind, type Limb } from '../../theme/sky';

export type SceneRect = { width: number; top: number; height: number };

/** Every static shape as an SVG path in screen points, inside the scene rectangle. */
export function scenePaths(rect: SceneRect) {
  const at = (x: number, y: number) => `${x * rect.width} ${rect.top + y * rect.height}`;
  const f = sceneShapes.fuji;
  const [h1, h2] = f.slope as readonly [readonly number[], readonly number[]];
  const mirror = (x: number) => f.footLeft + f.footRight - x;
  const slopeLeft = `C${at(h1[0] as number, h1[1] as number)} ${at(h2[0] as number, h2[1] as number)} ${at(f.footLeft, f.footY)}`;
  const slopeRightUp = `C${at(mirror(h2[0] as number), h2[1] as number)} ${at(mirror(h1[0] as number), h1[1] as number)} ${at(f.summitRight, f.summitY)}`;
  const summit = `M${at(f.summitLeft, f.summitY)}`;
  const crater = `Q${at(0.5, f.summitY + f.summitDip)} ${at(f.summitLeft, f.summitY)}`;
  const line = sceneShapes.snowLine;
  const first = line[0] as readonly number[];
  const last = line[line.length - 1] as readonly number[];
  const p = sceneShapes.pool;
  const midX = (p.left + p.right) / 2;
  return {
    mountain: `${summit} ${slopeLeft} L${at(f.footRight, f.footY)} ${slopeRightUp} ${crater} Z`,
    // The snow cap follows the summit and slopes, then returns along the jagged snow line.
    snow: `${summit} L${at(first[0] as number, first[1] as number)} ${line
      .slice(1)
      .map((q) => `L${at(q[0] as number, q[1] as number)}`)
      .join(' ')} L${at(last[0] as number, last[1] as number)} L${at(f.summitRight, f.summitY)} ${crater} Z`,
    snowShadows: sceneShapes.snowShadows
      .map(([topX, topY, bottomX, bottomY]) => `M${at(topX as number, topY as number)} L${at((bottomX as number) + 0.008, bottomY as number)} L${at((bottomX as number) - 0.008, bottomY as number)} Z`)
      .join(' '),
    pool: `M${at(p.left, p.topY)} L${at(p.right, p.topY)} Q${at(p.right - 0.14, p.bottomY)} ${at(midX, p.bottomY)} Q${at(p.left + 0.14, p.bottomY)} ${at(p.left, p.topY)} Z`,
    hillFar: `M${at(0, 0.6)} C${at(0.15, 0.57)} ${at(0.26, 0.6)} ${at(0.32, 0.625)} C${at(0.42, 0.655)} ${at(0.58, 0.655)} ${at(0.68, 0.625)} C${at(0.75, 0.6)} ${at(0.86, 0.57)} ${at(1, 0.6)} L${at(1, 1)} L${at(0, 1)} Z`,
    hillNear: `M${at(0, 0.76)} C${at(0.2, 0.7)} ${at(0.36, 0.78)} ${at(0.5, 0.8)} C${at(0.64, 0.82)} ${at(0.82, 0.72)} ${at(1, 0.75)} L${at(1, 1)} L${at(0, 1)} Z`,
    stream: streamOutline(rect),
  };
}

/** The stream at t, from 0 at Fuji's foot to 1 nearest the viewer, in scene fractions. */
export function streamAt(t: number): { x: number; y: number; width: number } {
  'worklet';
  const s = sceneShapes.stream;
  return {
    x: s.centerX + (s.bendStart + s.bendGrowth * t) * Math.sin(2 * Math.PI * s.bends * t),
    y: s.topY + (s.bottomY - s.topY) * t,
    width: s.widthStart + s.widthGrowth * t * t,
  };
}

function streamOutline(rect: SceneRect): string {
  const { samples } = sceneShapes.stream;
  const ts = Array.from({ length: samples + 1 }, (_, i) => i / samples);
  const edge = (t: number, sign: number) => {
    const p = streamAt(t);
    return `${(p.x + (sign * p.width) / 2) * rect.width} ${rect.top + p.y * rect.height}`;
  };
  return `M${ts.map((t) => edge(t, -1)).join(' L')} L${[...ts].reverse().map((t) => edge(t, 1)).join(' L')} Z`;
}

export type ShimmerPose = { x: number; y: number; length: number; opacity: number };

/** A glint drifting downstream. It stays inside the water and fades as it starts and ends. */
export function shimmerPose(clock: number, index: number): ShimmerPose {
  'worklet';
  const raw = clock * streamShimmer.speed + index / streamShimmer.count;
  const t = raw - Math.floor(raw);
  const p = streamAt(t);
  const length = Math.max(streamShimmer.minLength / 400, p.width * streamShimmer.lengthRatio);
  // Each glint keeps to its own lane across the stream's width.
  const lane = Math.sin(index * 12.9898) * 0.5;
  const room = Math.max(0, p.width - length) / 2;
  return {
    x: p.x + lane * 2 * room,
    y: p.y,
    length,
    opacity: Math.sin(Math.PI * t) * streamShimmer.peakOpacity,
  };
}

type Point = { x: number; y: number };

function seeded(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function limbPoint(limb: Limb, t: number, rect: SceneRect): Point {
  const [p0, p1, p2, p3] = limb.points;
  const u = 1 - t;
  const at = (i: 0 | 1) =>
    u * u * u * (p0[i] as number) + 3 * u * u * t * (p1[i] as number) + 3 * u * t * t * (p2[i] as number) + t * t * t * (p3[i] as number);
  return { x: at(0) * rect.width, y: rect.top + at(1) * rect.height };
}

/** A limb as a closed shape that tapers from its base width to its tip width. */
function limbOutline(limb: Limb, rect: SceneRect): string {
  const samples = Array.from({ length: blossom.limbSamples + 1 }, (_, i) => i / blossom.limbSamples);
  const side = (t: number, sign: number) => {
    const here = limbPoint(limb, t, rect);
    const a = limbPoint(limb, Math.max(0, t - 0.02), rect);
    const b = limbPoint(limb, Math.min(1, t + 0.02), rect);
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const half = ((limb.from + (limb.to - limb.from) * t) / 2) * sign;
    return `${here.x - ((b.y - a.y) / length) * half} ${here.y + ((b.x - a.x) / length) * half}`;
  };
  const forward = samples.map((t) => side(t, 1));
  const back = [...samples].reverse().map((t) => side(t, -1));
  return `M${forward.join(' L')} L${back.join(' L')} Z`;
}

/** One tree: its limbs as an SVG path, and where each flower sits. */
export function treeShape(limbs: readonly Limb[], rect: SceneRect, seedBase: number) {
  const outline = limbs.map((limb) => limbOutline(limb, rect)).join(' ');
  const flowers: (Point & { r: number })[] = [];
  limbs.forEach((limb, limbIndex) => {
    for (let i = 0; i < Math.round(limb.flowers * blossom.density); i += 1) {
      const seed = seedBase + limbIndex * 37 + i * 3;
      // Flowers gather toward the tips, as they do on real sakura.
      const t = 0.3 + 0.7 * Math.sqrt(seeded(seed));
      const p = limbPoint(limb, t, rect);
      flowers.push({
        x: p.x + (seeded(seed + 1) - 0.5) * blossom.scatter * 2,
        y: p.y + (seeded(seed + 2) - 0.5) * blossom.scatter * 2,
        r: blossom.radius * (0.7 + seeded(seed + 3) * 0.5),
      });
    }
  });
  return { outline, flowers };
}

/** A branch's sway in radians, a given number of seconds into a gust. Zero outside the gust. */
export function gustSway(elapsed: number): number {
  'worklet';
  if (elapsed <= 0 || elapsed >= wind.swayLength) return 0;
  const envelope = Math.sin((Math.PI * elapsed) / wind.swayLength);
  return envelope * envelope * Math.sin((2 * Math.PI * elapsed) / wind.swayPeriod) * wind.swayRadians;
}

export type PetalPose = { x: number; y: number; rotate: number; opacity: number };

/** A petal released from a blossom: it falls, sways, turns slowly and fades near the ground. */
export function petalPose(elapsed: number, originX: number, originY: number, groundY: number, phase: number): PetalPose {
  'worklet';
  const p = fallingPetal;
  if (elapsed < 0 || elapsed >= p.life) return { x: originX, y: originY, rotate: 0, opacity: 0 };
  const t = elapsed / p.life;
  // Starts gently as it lets go, then falls at a steady pace.
  const fall = t * t * (1.5 - 0.5 * t);
  const sway = Math.sin(2 * Math.PI * p.swayPerSecond * elapsed + phase) - Math.sin(phase);
  const fadeIn = Math.min(1, elapsed / p.fadeIn);
  const fadeOut = Math.min(1, (1 - fall) / p.fadeOutShare);
  return {
    x: originX + sway * p.swayDistance * Math.min(1, t * 3) + p.drift * t,
    y: originY + (groundY - originY) * fall,
    rotate: phase + elapsed * p.spinPerSecond,
    opacity: Math.max(0, fadeIn * fadeOut),
  };
}

