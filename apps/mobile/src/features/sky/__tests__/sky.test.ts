import { colors } from '../../../theme/tokens';
import { moodLevels } from '../../../theme/sky';
import {
  isSleepy,
  moonIllumination,
  moonLitPath,
  moonPhase,
  moonProgress,
  sunProgress,
  wrapMinute,
} from '../astro';
import { contrastBetween, nightAmount, skyStops, skyTextContrast, skyTextIsWhite, timeStops } from '../skyColors';

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

describe('sun and moon arcs', () => {
  it('puts the sun at its midpoint at noon', () => {
    expect(sunProgress(720)).toBeCloseTo(0.5);
  });

  it('moves the moon from sunset to sunrise across midnight', () => {
    expect(moonProgress(1080)).toBeCloseTo(0);
    expect(moonProgress(0)).toBeCloseTo(0.5);
    expect(moonProgress(359)).toBeLessThan(1);
  });

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
});

describe('sky blends', () => {
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

  it('dims with a low mood and brightens with a high one', () => {
    const sum = (m: number, mood: number) => (skyStops(m, mood)[2] as number[]).reduce((p, q) => p + q, 0);
    expect(sum(720, 1)).toBeLessThan(sum(720, 3));
    expect(sum(0, 5)).toBeGreaterThan(sum(0, 3));
  });
});

describe('WCAG AA', () => {
  it('passes for the headline at every minute of the day and every mood', () => {
    let lowest = Infinity;
    let at = '';
    for (let m = 0; m < 1440; m += 1) {
      for (let mood = 1; mood <= moodLevels; mood += 0.5) {
        const c = skyTextContrast(m, mood);
        if (c < lowest) {
          lowest = c;
          at = `minute ${m}, mood ${mood}, white ${skyTextIsWhite(m, mood)}`;
        }
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
  });
});
