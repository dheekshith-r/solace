import { bandOf, CHECKINS, needsSupport, OPENING, scoreOf } from '../questions';

describe('Reflect', () => {
  it('has four questions in each check-in, with four answers each', () => {
    for (const set of Object.values(CHECKINS)) {
      expect(set.questions).toHaveLength(4);
      expect(set.answers).toHaveLength(4);
    }
    expect(CHECKINS.mood.answers).toEqual(['Not at all', 'A few days', 'Most days', 'Nearly every day']);
    expect(OPENING).toBe("This isn't a test, there are no wrong answers. You can stop anytime.");
  });

  it('bands scores at 0–4, 5–8 and 9–12', () => {
    expect([0, 4, 5, 8, 9, 12].map(bandOf)).toEqual(['steady', 'steady', 'stretched', 'stretched', 'strained', 'strained']);
    expect(scoreOf([3, 2, 1, 0])).toBe(6);
  });

  it('shows support for the strained band', () => {
    expect(needsSupport('anxiety', [3, 3, 3, 0])).toBe(true);
    expect(needsSupport('anxiety', [1, 1, 1, 1])).toBe(false);
  });

  it('shows support when Mood question 2 is "Nearly every day", whatever the total', () => {
    expect(needsSupport('mood', [0, 3, 0, 0])).toBe(true);
    expect(needsSupport('self_talk', [0, 3, 0, 0])).toBe(false);
  });
});
