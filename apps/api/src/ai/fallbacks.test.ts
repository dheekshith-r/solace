import { describe, expect, it } from 'vitest';
import { fallbackGreeting, fallbackSuggestion } from './fallbacks';

describe('handwritten fallbacks claim nothing the user didn’t log (Ddk, Nov 7)', () => {
  it('with no mood just logged, the suggestion says nothing about mood or "today"', () => {
    for (let i = 0; i < 40; i += 1) {
      const { text } = fallbackSuggestion(null, `user-${i}:2026-11-07`);
      // Whole words: "slow breathing" is not a mood.
      expect(text).not.toMatch(/\b(middle|okay|low|heavy|good|great|today|feeling)\b/i);
    }
  });

  it('after a check-in, the suggestion fits the mood just logged', () => {
    expect(fallbackSuggestion(1, 'c1').text).toMatch(/heavy|rough/i);
  });

  it('goal greetings never name a time of day', () => {
    for (const goal of ['calm', 'sleep', 'focus', 'confidence', 'connection'] as const) {
      const line = fallbackGreeting({ name: 'Asha', goal, lastMood: null, key: 'k' });
      expect(line).not.toMatch(/tonight|morning|evening|afternoon|night/i);
    }
  });
});
