// Scene shapes and the owl's flight. Pure, so tests can check them without drawing.

import { owlTimeline, sceneShapes } from '../../theme/sky';

export type SceneRect = { width: number; top: number; height: number };

/** Every static shape as an SVG path in screen points, inside the scene rectangle. */
export function scenePaths(rect: SceneRect) {
  const at = (x: number, y: number) => `${x * rect.width} ${rect.top + y * rect.height}`;
  const polygon = (points: readonly (readonly number[])[]) => {
    const [first, ...rest] = points.map((p) => at(p[0] as number, p[1] as number));
    return `M${first} ${rest.map((p) => `L${p}`).join(' ')} Z`;
  };
  return {
    mountain: polygon(sceneShapes.mountain),
    snow: polygon(sceneShapes.snow),
    hillFar: `M${at(0, 0.8)} C${at(0.2, 0.66)} ${at(0.35, 0.74)} ${at(0.5, 0.7)} C${at(0.68, 0.64)} ${at(0.82, 0.76)} ${at(1, 0.68)} L${at(1, 1)} L${at(0, 1)} Z`,
    hillNear: `M${at(0, 0.9)} C${at(0.25, 0.8)} ${at(0.45, 0.94)} ${at(0.62, 0.87)} C${at(0.78, 0.8)} ${at(0.9, 0.86)} ${at(1, 0.82)} L${at(1, 1)} L${at(0, 1)} Z`,
    stream: `M${at(0.46, 1)} C${at(0.5, 0.95)} ${at(0.62, 0.92)} ${at(0.56, 0.86)} C${at(0.52, 0.82)} ${at(0.47, 0.79)} ${at(0.496, 0.72)} L${at(0.504, 0.72)} C${at(0.49, 0.79)} ${at(0.55, 0.82)} ${at(0.6, 0.86)} C${at(0.67, 0.92)} ${at(0.62, 0.96)} ${at(0.62, 1)} Z`,
    branchLeft: `M${at(0, 0.16)} Q${at(0.16, 0.15)} ${at(0.31, 0.1)} Q${at(0.16, 0.18)} ${at(0, 0.2)} Z M${at(0.13, 0.155)} Q${at(0.19, 0.21)} ${at(0.25, 0.3)} Q${at(0.18, 0.23)} ${at(0.125, 0.17)} Z`,
    branchRight: `M${at(1, 0.2)} Q${at(0.84, 0.16)} ${at(0.68, 0.11)} Q${at(0.84, 0.19)} ${at(1, 0.24)} Z M${at(0.88, 0.17)} Q${at(0.82, 0.23)} ${at(0.76, 0.31)} Q${at(0.83, 0.25)} ${at(0.885, 0.19)} Z`,
  };
}

export type OwlPose = {
  x: number; // Fraction of scene width.
  y: number; // Fraction of scene height.
  scale: number;
  opacity: number;
  wing: number; // Degrees. 0 is folded.
  look: number; // 0 looks along the branch, 1 looks at the user.
  eyeOpen: number; // 1 open, 0 closed.
};

function smooth(t: number): number {
  'worklet';
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function blink(elapsed: number, start: number, length: number): number {
  'worklet';
  const t = (elapsed - start) / length;
  if (t <= 0 || t >= 1) return 1;
  return Math.abs(2 * t - 1);
}

/** Where the owl is, a given number of seconds into its visit. */
export function owlPose(elapsed: number): OwlPose {
  'worklet';
  const o = owlTimeline;
  if (elapsed < 0 || elapsed >= o.flyEnd) {
    return { x: o.leave.x, y: o.leave.y, scale: o.leaveScale, opacity: 0, wing: 0, look: 0, eyeOpen: 1 };
  }

  const flap = Math.sin(2 * Math.PI * o.flapPerSecond * elapsed) * o.flapDegrees;

  if (elapsed < o.glideEnd) {
    const t = smooth(elapsed / o.glideEnd);
    return {
      x: o.enter.x + (o.perch.x - o.enter.x) * t,
      // Sinks in a long, shallow curve, then levels out onto the branch.
      y: o.enter.y + (o.perch.y - o.enter.y) * Math.sin((t * Math.PI) / 2),
      scale: 1,
      opacity: 1,
      wing: flap * (1 - smooth((elapsed - (o.glideEnd - o.wingFoldTime)) / o.wingFoldTime)),
      look: 0,
      eyeOpen: 1,
    };
  }

  if (elapsed < o.turnBackEnd) {
    const look =
      elapsed < o.holdEnd
        ? smooth((elapsed - o.settleEnd) / (o.turnEnd - o.settleEnd))
        : 1 - smooth((elapsed - o.holdEnd) / (o.turnBackEnd - o.holdEnd));
    return {
      x: o.perch.x,
      y: o.perch.y,
      scale: 1,
      opacity: 1,
      wing: 0,
      look,
      eyeOpen: Math.min(blink(elapsed, o.blinkStart, o.blinkLength), blink(elapsed, o.secondBlinkStart, o.blinkLength)),
    };
  }

  const t = smooth((elapsed - o.turnBackEnd) / (o.flyEnd - o.turnBackEnd));
  return {
    x: o.perch.x + (o.leave.x - o.perch.x) * t,
    y: o.perch.y + (o.leave.y - o.perch.y) * t - Math.sin(Math.PI * t) * o.arcLift,
    scale: 1 + (o.leaveScale - 1) * t,
    opacity: 1 - smooth((elapsed - o.fadeFrom) / (o.flyEnd - o.fadeFrom)),
    wing: flap,
    look: 0,
    eyeOpen: 1,
  };
}
