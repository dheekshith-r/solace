// Scene shapes and the owl's flight. Pure, so tests can check them without drawing.

import { blossom, fallingPetal, meadow, sceneShapes, streamShimmer, treeDrop, wind, type Limb } from '../../theme/sky';

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
    bank: streamOutline(rect, sceneShapes.stream.bankScale),
    hillFront: `M${at(0, 0.8)} C${at(0.16, 0.76)} ${at(0.34, 0.83)} ${at(0.52, 0.85)} C${at(0.7, 0.86)} ${at(0.84, 0.77)} ${at(1, 0.79)} L${at(1, 1)} L${at(0, 1)} Z`,
    ...grassPaths(at),
    ...fujiDetailPaths(rect, at),
  };
}

/** Fine grass texture: blades get taller toward the viewer, split into dark and light sets. */
function grassPaths(at: (x: number, y: number) => string) {
  const m = meadow;
  const dark: string[] = [];
  const light: string[] = [];
  for (let i = 0; i < m.bladeCount; i += 1) {
    const x = seeded(i + 1301);
    // More blades toward the viewer, as the ground is closer.
    const depth = Math.sqrt(seeded(i + 1361));
    const y = m.bladeTop + depth * (1 - m.bladeTop);
    const height = m.bladeMinHeight + depth * (m.bladeMaxHeight - m.bladeMinHeight);
    const lean = (seeded(i + 1423) - 0.5) * height * 0.7;
    const half = (m.bladeWidth * (0.5 + depth)) / 2;
    const left = Math.max(0, x - half);
    const right = Math.min(1, x + half);
    const tip = Math.min(1, Math.max(0, x + lean));
    const blade = `M${at(left, y)} L${at(right, y)} L${at(tip, y - height)} Z`;
    (i % 2 === 0 ? dark : light).push(blade);
  }
  return { grassDark: dark.join(' '), grassLight: light.join(' ') };
}

/** Grass tufts for one sway batch, standing on a baseline in screen points. */
export function tuftBatch(batch: number, width: number, baseY: number): string {
  const m = meadow;
  const parts: string[] = [];
  for (let i = 0; i < m.tuftCount; i += 1) {
    if (i % m.swayBatches !== batch) continue;
    const stream = streamAt(1);
    let x = (seeded(i + 1499) * 0.96 + 0.02) * width;
    // Keep the water clear: tufts stand on the banks.
    if (Math.abs(x / width - stream.x) < stream.width * 0.45) x = (x / width < stream.x ? 0.08 + seeded(i + 1511) * 0.1 : 0.82 + seeded(i + 1511) * 0.1) * width;
    for (let b = 0; b < m.tuftBlades; b += 1) {
      const s = seeded(i * 7 + b + 1553);
      const offset = (b / (m.tuftBlades - 1) - 0.5) * m.tuftSpread;
      const height = m.tuftMinHeight + s * (m.tuftMaxHeight - m.tuftMinHeight);
      const tip = x + offset * 1.7 + (s - 0.5) * 4;
      parts.push(
        `M${x + offset - m.tuftBlade / 2} ${baseY} Q${x + offset} ${baseY - height * 0.6} ${tip} ${baseY - height} Q${x + offset + m.tuftBlade} ${baseY - height * 0.5} ${x + offset + m.tuftBlade / 2} ${baseY} Z`,
      );
    }
  }
  return parts.join(' ');
}

/** Fine detail on Fuji: ridges in the snow, tongues of snow on the rock, and slope texture. */
function fujiDetailPaths(rect: SceneRect, at: (x: number, y: number) => string) {
  const d = sceneShapes.fujiDetail;
  const sliver = (x0: number, y0: number, x1: number, y1: number, width: number) =>
    `M${at(x0 - width / 2, y0)} L${at(x0 + width / 2, y0)} L${at(x1, y1)} Z`;

  const ridges = Array.from({ length: d.ridgeCount }, (_, i) => {
    const u = ((i + 0.5) / d.ridgeCount) * 2 - 1;
    const bottom = d.ridgeMinBottom + seeded(i + 901) * (d.ridgeMaxBottom - d.ridgeMinBottom);
    const reach = (bottom - d.ridgeTop) / (d.ridgeMaxBottom - d.ridgeTop);
    return sliver(0.5 + u * 0.035, d.ridgeTop, 0.5 + u * d.ridgeSpread * reach, bottom, d.ridgeWidth);
  }).join(' ');

  // Snow tongues start on the snow line and run down the slope, pointing away from the summit.
  const line = sceneShapes.snowLine;
  const streaks = Array.from({ length: d.streakCount }, (_, i) => {
    const a = line[Math.floor(seeded(i + 941) * (line.length - 1))] as readonly number[];
    const x = (a[0] as number) + seeded(i + 967) * 0.02 - 0.01;
    const y = (a[1] as number) - 0.01;
    const length = d.streakMinLength + seeded(i + 983) * (d.streakMaxLength - d.streakMinLength);
    return sliver(x, y, x + (x - 0.5) * length * 1.6, y + length, d.streakWidth);
  }).join(' ');

  const slopeLines = Array.from({ length: d.slopeCount }, (_, i) => {
    const u = ((i + seeded(i + 1009)) / d.slopeCount) * 2 - 1;
    const bottom = d.slopeMinBottom + seeded(i + 1031) * (d.slopeMaxBottom - d.slopeMinBottom);
    return sliver(0.5 + u * 0.2, d.slopeTop, 0.5 + u * d.slopeSpread, bottom, d.slopeWidth);
  }).join(' ');

  const ticks = Array.from({ length: d.tickCount }, (_, i) => {
    const x = 0.14 + seeded(i + 1061) * 0.72;
    const y = d.slopeTop + seeded(i + 1103) * (sceneShapes.fuji.footY - d.slopeTop);
    return sliver(x, y, x + (x - 0.5) * 0.03, y + d.tickLength, 0.0025);
  }).join(' ');

  return { ridges, streaks, slopeLines, ticks };
}

/** The stream at t, from 0 at Fuji's foot to 1 nearest the viewer, in scene fractions. */
export function streamAt(t: number): { x: number; y: number; width: number } {
  'worklet';
  const s = sceneShapes.stream;
  return {
    x: s.centerX - (s.bendStart + s.bendGrowth * t) * Math.sin(2 * Math.PI * s.bends * t),
    y: s.topY + (s.bottomY - s.topY) * t,
    width: s.widthStart + s.widthGrowth * t ** s.widthPower,
  };
}

function streamOutline(rect: SceneRect, widthScale = 1): string {
  const { samples } = sceneShapes.stream;
  const ts = Array.from({ length: samples + 1 }, (_, i) => i / samples);
  const edge = (t: number, sign: number) => {
    const p = streamAt(t);
    const x = Math.min(1, Math.max(0, p.x + (sign * p.width * widthScale) / 2));
    return `${x * rect.width} ${rect.top + p.y * rect.height}`;
  };
  return `M${ts.map((t) => edge(t, -1)).join(' L')} L${[...ts].reverse().map((t) => edge(t, 1)).join(' L')} Z`;
}

export type ShimmerPose = { x: number; y: number; length: number; thickness: number; opacity: number };

/** A soft highlight flowing toward the mountain. It stays in the water and fades in and out. */
export function shimmerPose(clock: number, index: number): ShimmerPose {
  'worklet';
  const raw = index / streamShimmer.count - clock * streamShimmer.speed;
  const t = raw - Math.floor(raw);
  const p = streamAt(t);
  const length = Math.min(p.width, Math.max(streamShimmer.minLength, p.width * streamShimmer.lengthRatio));
  // Each glint keeps to its own lane across the stream's width.
  const lane = Math.sin(index * 12.9898) * 0.5;
  const room = Math.max(0, p.width - length) / 2;
  return {
    x: p.x + lane * 2 * room,
    y: p.y,
    length,
    thickness: p.width * streamShimmer.thicknessRatio,
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
  return { x: at(0) * rect.width, y: rect.top + (at(1) + treeDrop) * rect.height };
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

export type PetalPose = { x: number; y: number; rotate: number; flutter: number; opacity: number };

/** A petal released from a blossom: it falls, sways, turns slowly and fades near the ground. */
export function petalPose(elapsed: number, originX: number, originY: number, groundY: number, phase: number): PetalPose {
  'worklet';
  const p = fallingPetal;
  if (elapsed < 0 || elapsed >= p.life) return { x: originX, y: originY, rotate: 0, flutter: 1, opacity: 0 };
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
    flutter: p.flutterMin + (1 - p.flutterMin) * Math.abs(Math.cos(2 * Math.PI * p.flutterPerSecond * elapsed + phase)),
    opacity: Math.max(0, fadeIn * fadeOut),
  };
}

