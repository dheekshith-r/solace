import { blossom, fallingPetal, meadow, sceneShapes, streamShimmer, treeDrop, trees, wind } from '../../../theme/sky';
import { colors } from '../../../theme/tokens';
import { isSleepy, moonIllumination, moonLitPath, moonPhase, wrapMinute } from '../astro';
import { gustSway, petalPose, scenePaths, shimmerPose, streamAt, treeShape, tuftBatch } from '../landscape';
import {
  contrastBetween,
  moonAmount,
  nightAmount,
  skyTextContrast,
  skyTextIsWhite,
  sunAmount,
  timeStops,
} from '../skyColors';

const AA = 4.5;
const GRAPHIC = 3;

describe('moon phase', () => {
  it('is near full on known full moons', () => {
    expect(moonIllumination(moonPhase(Date.UTC(2025, 10, 5, 13, 19)))).toBeGreaterThan(0.97);
    expect(moonIllumination(moonPhase(Date.UTC(2024, 7, 19, 18, 26)))).toBeGreaterThan(0.97);
  });

  it('is near new on known new moons', () => {
    expect(moonIllumination(moonPhase(Date.UTC(2025, 0, 29, 12, 36)))).toBeLessThan(0.03);
    expect(moonIllumination(moonPhase(Date.UTC(2024, 3, 8, 18, 21)))).toBeLessThan(0.03);
  });

  it('stays in range for dates before the reference', () => {
    const phase = moonPhase(Date.UTC(1990, 0, 1));
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(1);
  });

  it('lights the right side while waxing and the left while waning', () => {
    expect(moonLitPath(0.1, 20)).toContain('0 0 1 0 20');
    expect(moonLitPath(0.9, 20)).toContain('0 0 0 0 20');
  });

  it('draws a crescent and a gibbous moon with different terminators', () => {
    expect(moonLitPath(0.1, 20)).not.toEqual(moonLitPath(0.4, 20));
  });
});

describe('time of day', () => {
  it('wraps minutes past midnight', () => {
    expect(wrapMinute(1500)).toBe(60);
    expect(wrapMinute(-60)).toBe(1380);
  });

  it('makes Sola sleepy after 10 pm only', () => {
    expect(isSleepy(1319)).toBe(false);
    expect(isSleepy(1320)).toBe(true);
    expect(isSleepy(120)).toBe(true);
    expect(isSleepy(720)).toBe(false);
  });

  it('reaches full day and full night', () => {
    expect(nightAmount(720)).toBe(0);
    expect(nightAmount(0)).toBe(1);
  });

  it('never shows the sun and moon together', () => {
    for (let m = 0; m < 1440; m += 0.5) {
      expect(Math.min(sunAmount(m), moonAmount(m))).toBe(0);
    }
  });

  it('shows the sun only between sunrise and sunset, and the moon only outside it', () => {
    for (let m = 0; m < 1440; m += 1) {
      const daytime = m >= 360 && m <= 1080;
      if (!daytime) expect(sunAmount(m)).toBe(0);
      if (daytime) expect(moonAmount(m)).toBe(0);
    }
    expect(sunAmount(720)).toBe(1);
    expect(moonAmount(0)).toBe(1);
  });

  it('changes gradually: no jump between consecutive minutes', () => {
    for (let m = 0; m < 1440; m += 1) {
      const a = timeStops(m);
      const b = timeStops(m + 1);
      a.forEach((stop, i) => {
        stop.forEach((value, c) => {
          expect(Math.abs(value - (b[i] as number[])[c]!)).toBeLessThan(12);
        });
      });
    }
  });
});

describe('scene', () => {
  const rect = { width: 400, top: 300, height: 200 };

  it('keeps every shape inside the scene rectangle', () => {
    Object.values(scenePaths(rect)).forEach((path) => {
      const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      numbers.forEach((value, index) => {
        if (index % 2 === 0) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(rect.width);
        } else {
          expect(value).toBeGreaterThanOrEqual(rect.top);
          expect(value).toBeLessThanOrEqual(rect.top + rect.height);
        }
      });
    });
  });
});

describe('trees', () => {
  const rect = { width: 400, top: 300, height: 200 };
  const summitLeft = 0.462;
  const summitRight = 0.538;

  it.each(['left', 'right'] as const)('grows the %s tree from its screen edge', (side) => {
    const main = trees[side][0];
    expect(main?.points[0]?.[0]).toBe(side === 'left' ? 0 : 1);
  });

  it.each(['left', 'right'] as const)('tapers every %s limb and keeps clear of the summit', (side) => {
    trees[side].forEach((limb) => {
      expect(limb.to).toBeLessThan(limb.from);
      limb.points.forEach(([x]) => {
        if (side === 'left') expect(x).toBeLessThan(summitLeft);
        else expect(x).toBeGreaterThan(summitRight);
      });
    });
  });

  it.each(['left', 'right'] as const)('starts every %s fork close to its parent', (side) => {
    const main = trees[side][0]!;
    trees[side].slice(1).forEach((fork) => {
      const [x, y] = fork.points[0] as readonly [number, number];
      const distance = Math.min(
        ...main.points.map((p) => Math.hypot((p[0] as number) - x, (p[1] as number) - y)),
        ...trees[side].slice(1, 2).flatMap((l) => l.points.map((p) => Math.hypot((p[0] as number) - x, (p[1] as number) - y))),
      );
      expect(distance).toBeLessThan(0.12);
    });
  });

  it.each(['left', 'right'] as const)('keeps every %s limb below Fuji’s peak', (side) => {
    trees[side].forEach((limb) => {
      limb.points.forEach(([, y]) => {
        expect((y as number) + treeDrop).toBeGreaterThan(sceneShapes.fuji.summitY);
      });
    });
  });

  it('places flowers on the tree and draws a shape for every limb', () => {
    const { outline, flowers } = treeShape(trees.left, rect, 1);
    expect(outline.match(/M/g)?.length).toBe(trees.left.length);
    expect(flowers.length).toBe(trees.left.reduce((sum, limb) => sum + Math.round(limb.flowers * blossom.density), 0));
  });
});

describe('meadow', () => {
  it('draws tufts in every sway batch, standing on the baseline', () => {
    for (let batch = 0; batch < meadow.swayBatches; batch += 1) {
      const path = tuftBatch(batch, 400, 500);
      expect(path).toContain(' 500 ');
      const ys = path.match(/ (-?\d+(\.\d+)?) /g)?.map(Number) ?? [];
      expect(Math.max(...ys.filter((y) => y > 400))).toBeLessThanOrEqual(500);
    }
  });
});

describe('wind and petals', () => {
  const origin = { x: 100, y: 300 };
  const ground = 500;
  const pose = (t: number) => petalPose(t, origin.x, origin.y, ground, 1);

  it('keeps the branches still outside a gust', () => {
    expect(gustSway(-1)).toBe(0);
    expect(gustSway(wind.swayLength)).toBe(0);
    expect(gustSway(1)).not.toBe(0);
  });

  it('keeps the sway slight', () => {
    for (let t = 0; t < wind.swayLength; t += 0.05) {
      expect(Math.abs(gustSway(t))).toBeLessThanOrEqual(wind.swayRadians);
    }
  });

  it('releases each petal from its blossom', () => {
    const start = pose(0);
    expect(start.x).toBeCloseTo(origin.x);
    expect(start.y).toBeCloseTo(origin.y);
  });

  it('falls steadily, only downward', () => {
    let previous = origin.y;
    for (let t = 0.1; t < fallingPetal.life; t += 0.1) {
      const y = pose(t).y;
      expect(y).toBeGreaterThanOrEqual(previous);
      previous = y;
    }
  });

  it('sways sideways and rotates slowly', () => {
    const xs = Array.from({ length: 100 }, (_, i) => pose((i / 100) * fallingPetal.life).x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(fallingPetal.swayDistance / 2);
    expect(pose(5).rotate).not.toBe(pose(1).rotate);
  });

  it('flutters as it falls without ever vanishing edge-on', () => {
    const values = Array.from({ length: 200 }, (_, i) => pose((i / 200) * fallingPetal.life).flutter);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(fallingPetal.flutterMin);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.3);
  });

  it('fades out near the ground, and is gone by the end', () => {
    expect(pose(fallingPetal.life / 3).opacity).toBe(1);
    expect(pose(fallingPetal.life - 0.05).opacity).toBeLessThan(0.05);
    expect(pose(fallingPetal.life).opacity).toBe(0);
  });
});

describe('stream', () => {
  const { count } = streamShimmer;

  it('widens from Fuji’s foot toward the viewer', () => {
    let previous = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const width = streamAt(t).width;
      expect(width).toBeGreaterThan(previous);
      previous = width;
    }
  });

  it('winds from side to side rather than running straight', () => {
    const xs = Array.from({ length: 40 }, (_, i) => streamAt(i / 39).x);
    const center = sceneShapes.stream.centerX;
    expect(Math.min(...xs)).toBeLessThan(center - 0.03);
    expect(Math.max(...xs)).toBeGreaterThan(center + 0.03);
  });

  it('starts at the water at Fuji’s foot', () => {
    const { pool } = sceneShapes;
    expect(streamAt(0).y).toBeGreaterThanOrEqual(pool.topY);
    expect(streamAt(0).y).toBeLessThanOrEqual(pool.bottomY);
  });

  it('keeps every glint inside the water as it moves', () => {
    for (let clock = 0; clock < 60; clock += 0.5) {
      for (let i = 0; i < count; i += 1) {
        const g = shimmerPose(clock, i);
        const t = (g.y - sceneShapes.stream.topY) / (sceneShapes.stream.bottomY - sceneShapes.stream.topY);
        const s = streamAt(t);
        expect(g.x - g.length / 2).toBeGreaterThanOrEqual(s.x - s.width / 2 - 0.01);
        expect(g.x + g.length / 2).toBeLessThanOrEqual(s.x + s.width / 2 + 0.01);
      }
    }
  });

  it('moves the highlights away from the viewer, toward the mountain', () => {
    expect(shimmerPose(5, 3).y).toBeLessThan(shimmerPose(1, 3).y);
  });

  it('narrows into the distance with perspective', () => {
    const near = streamAt(1).width;
    expect(streamAt(0).width).toBeLessThan(near / 20);
    expect(streamAt(0.5).width).toBeLessThan(near / 2.5);
  });
});

describe('WCAG AA', () => {
  it('passes for the date and headline at every minute of the day', () => {
    let lowest = Infinity;
    let at = '';
    for (let m = 0; m < 1440; m += 1) {
      const c = skyTextContrast(m);
      if (c < lowest) {
        lowest = c;
        at = `minute ${m}, white ${skyTextIsWhite(m)}`;
      }
    }
    expect({ passes: lowest >= AA, lowest: Number(lowest.toFixed(2)), at }).toMatchObject({ passes: true });
  });

  it.each(['light', 'dark'] as const)('passes for every %s token pair', (scheme) => {
    const c = colors[scheme];
    expect(contrastBetween(c.ink, c.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastBetween(c.ink, c.background)).toBeGreaterThanOrEqual(AA);
    expect(contrastBetween(c.ink, c.tint)).toBeGreaterThanOrEqual(AA);
    expect(contrastBetween(c.muted, c.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastBetween(c.muted, c.tint)).toBeGreaterThanOrEqual(AA);
    expect(contrastBetween(c.onAccent, c.accent)).toBeGreaterThanOrEqual(AA);
    expect(contrastBetween(c.accent, c.surface)).toBeGreaterThanOrEqual(GRAPHIC);
    expect(contrastBetween(c.accent, c.tint)).toBeGreaterThanOrEqual(GRAPHIC);
  });
});
