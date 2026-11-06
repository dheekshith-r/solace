import { PATTERNS, ROUNDS, orbTarget, timeline, totalSeconds } from './patterns';

describe('breathing patterns', () => {
  it('runs each pattern for four rounds in order', () => {
    expect(timeline('calm').map((p) => p.seconds)).toEqual([4, 4, 6, 4, 4, 6, 4, 4, 6, 4, 4, 6]);
    expect(timeline('box').filter((p) => p.round === 2).map((p) => p.label)).toEqual(['Breathe in', 'Hold', 'Breathe out', 'Hold']);
    expect(timeline('sleep')).toHaveLength(3 * ROUNDS);
  });

  it('adds up to the right length', () => {
    expect(totalSeconds('calm')).toBe(56);
    expect(totalSeconds('box')).toBe(64);
    expect(totalSeconds('sleep')).toBe(76);
  });

  it('fills the orb on the in-breath and the hold, and empties it on the out-breath', () => {
    expect(PATTERNS.calm.phases.map((p) => orbTarget(p.kind))).toEqual([1, 1, 0]);
    expect(PATTERNS.box.phases.map((p) => orbTarget(p.kind))).toEqual([1, 1, 0, 0]);
  });
});
