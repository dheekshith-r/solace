import { describe, expect, it } from 'vitest';
import { inventsDetails, mentionsTimeOfDay } from './grounding';

describe('lines shown all day never name a time of day (Ddk, Nov 7)', () => {
  it('rejects greetings and phrases tied to the hour', () => {
    for (const line of [
      'Good morning, Smoke, as you work towards sleeping better.',
      'Try a few slow breaths to settle into the morning.',
      'A calm evening could help.',
      'Rest well tonight.',
      'Your evenings have felt heavy.',
      'Asha, the exam worry from Tuesday evening sounded heavy.',
    ]) {
      expect(mentionsTimeOfDay(line)).toBe(true);
    }
  });

  it('allows days and "today"', () => {
    for (const line of [
      'Asha, the exam worry from Tuesday sounded heavy. Go gently today.',
      'Hi Smoke. I’m here for better rest, one small step at a time.',
      'A minute of slow breathing is a gentle way to begin.',
    ]) {
      expect(mentionsTimeOfDay(line)).toBe(false);
    }
  });
});

describe('grounding: only what the user said or logged (Ddk, Nov 7)', () => {
  const morningNoNote = 'Name: "Asha"\nNow: Sat, 7 Nov, morning\nThey just logged: 2/5 (low)';

  it('rejects claims about the past or current situation that the user never logged', () => {
    expect(inventsDetails('Starting the morning low after a difficult night makes the day heavier.', morningNoNote)).toBe(true);
    expect(inventsDetails('Before your exam, a slow breath could help.', morningNoNote)).toBe(true);
    expect(inventsDetails('Your exam sounds like a lot right now.', morningNoNote)).toBe(true);
    expect(inventsDetails('A rough day at work can weigh on you.', morningNoNote)).toBe(true);
    expect(inventsDetails('Your Tuesday sounded heavy.', morningNoNote)).toBe(true);
    expect(inventsDetails('That fight with your sister must still sting.', morningNoNote)).toBe(true);
    expect(inventsDetails('After such a long day, rest is earned.', morningNoNote)).toBe(true);
    expect(inventsDetails('You seem tired since yesterday.', morningNoNote)).toBe(true);
  });

  it('allows general suggestions for the future, even when they name a detail', () => {
    expect(inventsDetails('Maybe call a friend later.', morningNoNote)).toBe(false);
    expect(inventsDetails('A short walk could help.', morningNoNote)).toBe(false);
    expect(inventsDetails('Texting a friend or family member might lift the morning a little.', morningNoNote)).toBe(false);
    expect(inventsDetails('Try an early night to give yourself some rest.', morningNoNote)).toBe(false);
    expect(inventsDetails('If sleep has been hard, a slow exhale before bed could help.', morningNoNote)).toBe(false);
  });

  it('allows what the user did log, framed any way', () => {
    expect(inventsDetails('Feeling low this morning is a lot to carry; one slow breath could help.', morningNoNote)).toBe(false);
    const withNote = `${morningNoNote}, note: "couldn't sleep, exam tomorrow"`;
    expect(inventsDetails('Little sleep before your exam is hard; a slow exhale could settle you.', withNote)).toBe(false);
  });
});
