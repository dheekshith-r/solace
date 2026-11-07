import { describe, expect, it } from 'vitest';
import { inventsDetails } from './grounding';

describe('grounding: only what the user said or logged (Ddk, Nov 7)', () => {
  const morningNoNote = 'Name: "Asha"\nNow: Sat, 7 Nov, morning\nThey just logged: 2/5 (low)';

  it('rejects details the data never mentioned', () => {
    expect(inventsDetails('Starting the morning low after a difficult night makes the day heavier.', morningNoNote)).toBe(true);
    expect(inventsDetails('Before your exam, a slow breath could help.', morningNoNote)).toBe(true);
    expect(inventsDetails('A rough day at work can weigh on you.', morningNoNote)).toBe(true);
    expect(inventsDetails('Maybe call a friend later.', morningNoNote)).toBe(true);
    expect(inventsDetails('Your Tuesday sounded heavy.', morningNoNote)).toBe(true);
    expect(inventsDetails('Your Tuesday sounded heavy.', morningNoNote)).toBe(true);
  });

  it('allows what the data does mention', () => {
    expect(inventsDetails('Feeling low this morning is a lot to carry; one slow breath could help.', morningNoNote)).toBe(false);
    const withNote = `${morningNoNote}, note: "couldn't sleep, exam tomorrow"`;
    expect(inventsDetails('Little sleep before an exam is hard; a slow exhale could settle you.', withNote)).toBe(false);
  });
});