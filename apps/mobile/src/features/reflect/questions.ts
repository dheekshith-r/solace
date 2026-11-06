// Reflect's three check-ins, as approved by Ddk on Nov 6 (specs/tickets/10-reflect/questions.md).
// Friendly check-ins, not diagnoses. Each answer scores 0–3; each check-in 0–12.

export type ReflectKind = 'mood' | 'anxiety' | 'self_talk';
export type Band = 'steady' | 'stretched' | 'strained';

export const OPENING = "This isn't a test, there are no wrong answers. You can stop anytime.";

const OFTEN = ['Not at all', 'A few days', 'Most days', 'Nearly every day'] as const;
const HABIT = ['Rarely', 'Sometimes', 'Often', 'Almost always'] as const;

export const CHECKINS: Record<ReflectKind, { title: string; blurb: string; intro: string; answers: readonly string[]; questions: readonly string[] }> = {
  mood: {
    title: 'Mood',
    blurb: 'How the last two weeks have felt.',
    intro: "Let's look back over the last two weeks.",
    answers: OFTEN,
    questions: [
      'How often have the things you usually enjoy felt flat?',
      "How often have you felt low, heavy, or like things won't get better?",
      'How often has your sleep felt off, too little or too much?',
      'How often have you felt drained, with little energy for the day?',
    ],
  },
  anxiety: {
    title: 'Anxiety relief',
    blurb: 'How much worry has been around.',
    intro: 'Same two weeks, now about worry.',
    answers: OFTEN,
    questions: [
      'How often have you felt nervous, tense or on edge?',
      'How often has worry been hard to switch off?',
      'How often has it been hard to properly relax?',
      'How often have you felt that something bad might happen?',
    ],
  },
  self_talk: {
    title: 'Self-talk',
    blurb: 'How you speak to yourself.',
    intro: 'Now about how you talk to yourself.',
    answers: HABIT,
    questions: [
      'When something goes wrong, how often do you blame yourself first?',
      "How often are you harsher with yourself than you'd be with a friend?",
      'How often do you feel you have to be perfect to be okay?',
      'How often do you brush off things you did well?',
    ],
  },
};

export const BANDS: Record<Band, { name: string; message: string }> = {
  steady: { name: 'Steady ground', message: "Things feel fairly steady right now. That's worth noticing." },
  stretched: { name: 'A bit stretched', message: 'Some things have been weighing on you. A few gentle moves could help.' },
  strained: { name: 'Carrying a lot', message: "You've been carrying a lot. You don't have to carry it alone." },
};

export function scoreOf(answers: readonly number[]): number {
  return answers.reduce((sum, a) => sum + a, 0);
}

export function bandOf(score: number): Band {
  return score <= 4 ? 'steady' : score <= 8 ? 'stretched' : 'strained';
}

/** Show the support prompt (Tele-MANAS 14416): the strained band, or Mood Q2 "Nearly every day" whatever the total. */
export function needsSupport(kind: ReflectKind, answers: readonly number[]): boolean {
  return bandOf(scoreOf(answers)) === 'strained' || (kind === 'mood' && answers[1] === 3);
}

export function isReflectKind(value: unknown): value is ReflectKind {
  return value === 'mood' || value === 'anxiety' || value === 'self_talk';
}
