import { describe, expect, it } from 'vitest';
import { chatSystemPrompt, dailyPrompt } from './prompts';

const profile = { name: 'Asha', goal: 'sleep' as const, timezone: 'Asia/Kolkata' };
const history = {
  moods: [{ mood: 2, note: 'exam stress', createdAt: new Date('2026-11-05T14:00:00Z') }],
  assessment: { band: 'stretched' as const, score: 6, createdAt: new Date('2026-11-04T10:00:00Z') },
  summary: null,
};
const DAY_OR_TIME = /\b(mon|tue|wed|thu|fri|sat|sun)\b|morning|afternoon|evening|night|\d{1,2} (nov|oct)/i;
// The context block only: the persona text itself mentions "late at night" as an instruction.
const context = (prompt: string) => prompt.slice(prompt.lastIndexOf('<user_context>'), prompt.lastIndexOf('</user_context>'));

describe('chat context carries no day or time of day (Ddk, Nov 7)', () => {
  it('evening in Kolkata: no day name, date or part of day anywhere in the context', () => {
    const block = context(chatSystemPrompt({ profile, history, now: new Date('2026-11-07T14:00:00Z') }));
    expect(block).toContain('exam stress');
    expect(block).not.toMatch(DAY_OR_TIME);
  });

  it('11 pm to 5 am: only a late-night flag, so Sola can suggest rest', () => {
    const late = context(chatSystemPrompt({ profile, history, now: new Date('2026-11-07T19:30:00Z') })); // 1:00 in Kolkata
    expect(late).toContain('It is late at night for them');
    const evening = context(chatSystemPrompt({ profile, history, now: new Date('2026-11-07T16:30:00Z') })); // 22:00
    expect(evening).not.toContain('late at night');
  });

  it('the daily lines still get the full clock (unchanged)', () => {
    expect(dailyPrompt({ profile, history, now: new Date('2026-11-07T14:00:00Z') })).toMatch(/Their local time now: Sat.*7 Nov.*evening/);
  });
});
