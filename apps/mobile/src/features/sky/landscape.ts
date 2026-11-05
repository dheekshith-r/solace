// Scene shapes and motion. Pure, so tests can check them without drawing.

import { blossom, fallingPetal, meadow, sceneShapes, treeDrop, wind, type Limb } from '../../theme/sky';

export type SceneRect = { width: number; top: number; height: number };

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

type Point = { x: number; y: number };

function seeded(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function limbFraction(limb: Limb, t: number): Point {
  const [p0, p1, p2, p3] = limb.points;
  const u = 1 - t;
  const at = (i: 0 | 1) =>
    u * u * u * (p0[i] as number) + 3 * u * u * t * (p1[i] as number) + 3 * u * t * t * (p2[i] as number) + t * t * t * (p3[i] as number);
  return { x: at(0), y: at(1) };
}

function limbPoint(limb: Limb, t: number, rect: SceneRect): Point {
  const f = limbFraction(limb, t);
  return { x: f.x * rect.width, y: rect.top + (f.y + treeDrop) * rect.height };
}

function limbWidth(limb: Limb, t: number, seed: number): number {
  const base = limb.from + (limb.to - limb.from) * t ** 0.8;
  // Irregular taper: real wood swells and narrows along its length.
  const wobble = 1 + blossom.widthWobble * (Math.sin(t * 17 + seed) * 0.65 + Math.sin(t * 41 + seed * 2) * 0.35);
  return Math.max(0.4, base * wobble);
}

/** A limb as a closed shape that tapers irregularly from base to tip. */
function limbOutline(limb: Limb, rect: SceneRect, seed: number): string {
  const samples = Array.from({ length: blossom.limbSamples + 1 }, (_, i) => i / blossom.limbSamples);
  const side = (t: number, sign: number) => {
    const here = limbPoint(limb, t, rect);
    const a = limbPoint(limb, Math.max(0, t - 0.02), rect);
    const b = limbPoint(limb, Math.min(1, t + 0.02), rect);
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const half = (limbWidth(limb, t, seed) / 2) * sign;
    return `${here.x - ((b.y - a.y) / length) * half} ${here.y + ((b.x - a.x) / length) * half}`;
  };
  const forward = samples.map((t) => side(t, 1));
  const back = [...samples].reverse().map((t) => side(t, -1));
  return `M${forward.join(' L')} L${back.join(' L')} Z`;
}

/** Thin twigs growing off a limb at irregular points and angles. */
export function twigsOf(limb: Limb, seed: number): Limb[] {
  return Array.from({ length: blossom.twigsPerLimb }, (_, i) => {
    const s = seed + i * 13;
    const t = 0.3 + (0.62 * (i + seeded(s))) / blossom.twigsPerLimb;
    const start = limbFraction(limb, t);
    const ahead = limbFraction(limb, Math.min(1, t + 0.05));
    const heading = Math.atan2(ahead.y - start.y, ahead.x - start.x);
    const turn = (i % 2 === 0 ? 1 : -1) * (0.5 + seeded(s + 1) * 0.6);
    const angle = heading + turn;
    const length = blossom.twigMinLength + seeded(s + 2) * (blossom.twigMaxLength - blossom.twigMinLength);
    const go = (share: number, bend: number) => [
      start.x + Math.cos(angle + bend) * length * share,
      start.y + Math.sin(angle + bend) * length * share,
    ];
    return {
      points: [[start.x, start.y], go(0.35, 0.1), go(0.7, -0.12), go(1, -0.05)],
      from: Math.min(2.2, limbWidth(limb, t, seed) * 0.6),
      to: 0.45,
      flowers: 2,
    } as Limb;
  });
}

export type Flower = Point & { r: number; angle: number; layer: 0 | 1 | 2 };

/** The outline of one notched sakura petal, pointing along an angle from a flower's center. */
export function petalOutline(cx: number, cy: number, angle: number, r: number) {
  const at = (along: number, across: number): Point => ({
    x: cx + Math.cos(angle) * along * r - Math.sin(angle) * across * r,
    y: cy + Math.sin(angle) * along * r + Math.cos(angle) * across * r,
  });
  return {
    base: at(0.08, 0),
    c1: at(0.35, -0.42),
    c2: at(0.82, -0.5),
    tipLeft: at(1.02, -0.14),
    notch: at(0.86, 0),
    tipRight: at(1.02, 0.14),
    c3: at(0.82, 0.5),
    c4: at(0.35, 0.42),
  };
}

/** One tree: limbs and twigs as an SVG path, flower clusters, knots, and the joints where moss grows. */
export function treeShape(limbs: readonly Limb[], rect: SceneRect, seedBase: number) {
  const twigs = limbs.flatMap((limb, i) => twigsOf(limb, seedBase + i * 71));
  const outline = [...limbs, ...twigs].map((limb, i) => limbOutline(limb, rect, seedBase + i)).join(' ');
  const flowers: Flower[] = [];

  const addCluster = (center: Point, seed: number) => {
    const flowersHere: Flower[] = [];
    for (let i = 0; i < blossom.flowersPerCluster; i += 1) {
      const s = seed + i * 5;
      const spread = Math.sqrt(seeded(s));
      const heading = seeded(s + 1) * Math.PI * 2;
      flowersHere.push({
        x: center.x + Math.cos(heading) * spread * blossom.clusterRadius,
        y: center.y + Math.sin(heading) * spread * blossom.clusterRadius * 0.82,
        r: blossom.radius * (1 - blossom.radiusVariation / 2 + seeded(s + 2) * blossom.radiusVariation),
        angle: seeded(s + 3) * Math.PI * 2,
        // Inner flowers are deeper and darker, and outer ones sit on top.
        layer: spread < 0.45 ? 0 : spread < 0.8 ? 1 : 2,
      });
    }
    flowers.push(...flowersHere);
  };

  limbs.forEach((limb, limbIndex) => {
    const clusters = Math.max(1, Math.round(limb.flowers * blossom.clustersPerFlowerUnit));
    for (let i = 0; i < clusters; i += 1) {
      const seed = seedBase + limbIndex * 37 + i * 3;
      addCluster(limbPoint(limb, 0.3 + (0.7 * (i + seeded(seed))) / clusters, rect), seed);
    }
  });
  twigs.forEach((twig, i) => addCluster(limbPoint(twig, 1, rect), seedBase + 900 + i * 11));
  flowers.sort((a, b) => a.layer - b.layer);

  const knots = limbs
    .filter((limb) => limb.from >= blossom.knotMinLimbWidth)
    .flatMap((limb, limbIndex) =>
      Array.from({ length: blossom.knotsPerLimb }, (_, i) => {
        const seed = seedBase + limbIndex * 19 + i * 7 + 300;
        const t = 0.1 + seeded(seed) * 0.5;
        const p = limbPoint(limb, t, rect);
        return { x: p.x, y: p.y, r: limbWidth(limb, t, seed) * 0.26 };
      }),
    );
  const joints = limbs.slice(1).map((limb, i) => {
    const p = limbPoint(limb, 0, rect);
    return { x: p.x, y: p.y, r: limb.from * 1.25 + seeded(seedBase + i) };
  });

  return { outline, flowers, knots, joints };
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

