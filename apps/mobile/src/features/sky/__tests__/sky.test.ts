import { owlTimeline } from '../../../theme/sky';
import { colors } from '../../../theme/tokens';
import { isSleepy, moonIllumination, moonLitPath, moonPhase, wrapMinute } from '../astro';
import { owlPose, scenePaths } from '../landscape';
import { contrastBetween, nightAmount, skyTextContrast, skyTextIsWhite, timeStops } from '../skyColors';

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

describe('owl', () => {
  const o = owlTimeline;

  it('is hidden before and after its visit', () => {
    expect(owlPose(-1).opacity).toBe(0);
    expect(owlPose(o.flyEnd).opacity).toBe(0);
  });

  it('starts off-screen and lands on the perch with folded wings', () => {
    expect(owlPose(0).x).toBeGreaterThan(1);
    const landed = owlPose(o.glideEnd);
    expect(landed.x).toBeCloseTo(o.perch.x);
    expect(landed.y).toBeCloseTo(o.perch.y);
    expect(landed.wing).toBe(0);
  });

  it('arrives without a jump at the end of the glide', () => {
    const before = owlPose(o.glideEnd - 0.01);
    const after = owlPose(o.glideEnd + 0.01);
    expect(Math.abs(before.x - after.x)).toBeLessThan(0.01);
    expect(Math.abs(before.y - after.y)).toBeLessThan(0.01);
  });

  it('turns to look at the user, blinks, then turns back', () => {
    expect(owlPose(o.settleEnd).look).toBe(0);
    expect(owlPose(o.turnEnd).look).toBe(1);
    expect(owlPose(o.blinkStart + o.blinkLength / 2).eyeOpen).toBeCloseTo(0);
    expect(owlPose(o.holdEnd - 0.1).eyeOpen).toBe(1);
    expect(owlPose(o.turnBackEnd - 0.001).look).toBeCloseTo(0, 1);
  });

  it('flies toward the mountain, shrinking and fading', () => {
    const end = owlPose(o.flyEnd - 0.01);
    expect(end.x).toBeCloseTo(o.leave.x, 1);
    expect(end.scale).toBeCloseTo(o.leaveScale, 1);
    expect(end.opacity).toBeLessThan(0.05);
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
