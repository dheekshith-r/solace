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

