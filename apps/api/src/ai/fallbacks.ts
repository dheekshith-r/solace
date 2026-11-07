/**
 * Handwritten lines used whenever a model call fails or times out (spec 5.3).
 * Choices are deterministic per user and day, so a fallback doesn't change on every refresh.
 */
import { createHash } from 'node:crypto';
import type { AssessmentBand, Goal, Move, Suggestion } from '@solace/shared';

/** A stable index in [0, length) for a key. */
export function pick<T>(items: readonly T[], key: string): T {
  const digest = createHash('sha256').update(key).digest();
  const item = items[digest.readUInt32BE(0) % items.length];
  if (item === undefined) throw new Error('pick from an empty list');
  return item;
}

/** Thirty affirmations: first person, believable, no cheerleading. */
export const FALLBACK_AFFIRMATIONS: readonly string[] = [
  'I can take this one breath at a time.',
  'My feelings make sense, even the messy ones.',
  'I am allowed to go slowly today.',
  'Resting is part of the work, not a break from it.',
  'I have handled hard days before, and I learned from them.',
  'I can be kind to myself while I figure this out.',
  'One small step still counts as moving.',
  'I don’t have to have everything sorted to be okay.',
  'It is fine to ask for help when I need it.',
  'My worth isn’t measured by how much I got done.',
  'I can notice a worry without letting it steer.',
  'Today I will give myself the patience I give my friends.',
  'I am learning, and learning is allowed to look clumsy.',
  'Some days are for coping, and that is enough.',
  'I can let this moment be what it is.',
  'I deserve the same care I offer other people.',
  'My breath is always here when I need somewhere to land.',
  'I can choose one thing to focus on and let the rest wait.',
  'Feeling tired doesn’t mean I’m failing.',
  'I can start again at any point in the day.',
  'I’m allowed to take up space.',
  'Small, steady habits are quietly changing me.',
  'I can say no to what drains me.',
  'I am more than the thoughts I have when I’m anxious.',
  'I can make room for joy, even on an ordinary day.',
  'Being gentle with myself is a strength.',
  'I don’t need to rush my healing.',
  'I can trust myself to handle what comes next.',
  'It’s okay that some things are still unfinished.',
  'I showed up today, and that matters.',
];

/** Suggestions after a check-in, by mood (1 = very low … 5 = great). */
const SUGGESTIONS_BY_MOOD: Record<number, readonly Suggestion[]> = {
  1: [
    { text: 'That sounds like a heavy moment. A few slow breaths with me might soften the edges a little.', action: 'breathe' },
    { text: 'Rough days deserve gentleness. Want to tell Sola what’s weighing on you?', action: 'none' },
  ],
  2: [
    { text: 'A bit low today. A slow exhale, longer than the inhale, can help your body settle.', action: 'breathe' },
    { text: 'When things feel flat, naming them can help. A quick Reflect might show what’s underneath.', action: 'reflect' },
  ],
  3: [
    { text: 'Somewhere in the middle today. A short pause to check in with yourself could help you see which way it’s leaning.', action: 'reflect' },
    { text: 'An okay kind of day. A minute of slow breathing is a nice way to reset before what’s next.', action: 'breathe' },
  ],
  4: [
    { text: 'Good to hear. Today’s affirmation might help you hold on to this feeling.', action: 'affirmation' },
    { text: 'A good day is worth noticing. What helped? Sola would love to hear.', action: 'none' },
  ],
  5: [
    { text: 'You’re feeling great. Take a second to notice what made today good, so you can find it again.', action: 'affirmation' },
    { text: 'Lovely. Sharing what went well with Sola can make it stick.', action: 'none' },
  ],
};

/**
 * When no mood was just logged (a new user, or the day's line before any check-in). These claim
 * nothing about how the user feels (Ddk, Nov 7: "Somewhere in the middle today" for a user who
 * had logged nothing broke the grounding rule).
 */
const NEUTRAL_SUGGESTIONS: readonly Suggestion[] = [
  { text: 'A minute of slow breathing is a gentle way to begin.', action: 'breathe' },
  { text: 'A short Reflect check-in can help you notice how you’re doing.', action: 'reflect' },
];

export const ALL_FALLBACK_SUGGESTIONS: readonly Suggestion[] = [...Object.values(SUGGESTIONS_BY_MOOD).flat(), ...NEUTRAL_SUGGESTIONS];

/** `mood` is a mood the user has just logged; pass null otherwise, and nothing about mood is claimed. */
export function fallbackSuggestion(mood: number | null, key: string): Suggestion {
  const options = mood === null ? NEUTRAL_SUGGESTIONS : (SUGGESTIONS_BY_MOOD[mood] ?? NEUTRAL_SUGGESTIONS);
  return pick(options, key);
}

/** Reflect moves when the model is unavailable, three per band. */
export const FALLBACK_MOVES: Record<AssessmentBand, readonly Move[]> = {
  steady: [
    { text: 'Things look fairly steady. Notice one thing that helped this week and keep it going.', action: 'affirmation' },
    { text: 'A minute of slow breathing is a nice way to keep this calm going.', action: 'breathe' },
    { text: 'A quick mood check-in tomorrow can show what keeps you steady.', action: 'checkin' },
  ],
  stretched: [
    { text: 'You’ve been carrying a fair bit. Two minutes of slow breathing can take the edge off.', action: 'breathe' },
    { text: 'Tell Sola what has felt heaviest lately; putting it into words often helps.', action: 'chat' },
    { text: 'Log a mood check-in each evening this week to spot what shifts things.', action: 'checkin' },
  ],
  strained: [
    { text: 'This has been a hard stretch. Consider telling someone you trust how you’ve been.', action: 'chat' },
    { text: 'When it feels like a lot, a slow breath out, longer than the breath in, can help.', action: 'breathe' },
    { text: 'Come back to Reflect in a few days, so you can see how things are moving.', action: 'reflect' },
  ],
};

const GOAL_PHRASES: Record<Goal, string> = {
  calm: 'a calmer day',
  // No time of day: the line is shown at any hour (Ddk, Nov 7).
  sleep: 'better rest',
  focus: 'a clearer head',
  confidence: 'a little more trust in yourself',
  connection: 'feeling a bit more connected',
};

/** Sola's daily line when the model is unavailable. Uses only what we know for sure. */
export function fallbackGreeting(input: {
  name: string;
  goal: Goal | null;
  lastMood: number | null;
  key: string;
}): string {
  const { name, goal, lastMood, key } = input;
  if (lastMood !== null && lastMood <= 2) {
    return pick(
      [
        `${name}, last time things felt heavy. No pressure today, I’m here whenever you want to talk.`,
        `Hi ${name}. You had a low moment recently, so let’s keep today gentle.`,
      ],
      key,
    );
  }
  if (lastMood !== null && lastMood >= 4) {
    return `Hi ${name}. You were feeling good last time, let’s see what today brings.`;
  }
  if (goal) return `Hi ${name}. I’m here for ${GOAL_PHRASES[goal]}, one small step at a time.`;
  return `Hi ${name}. I’m here whenever you want to talk.`;
}
