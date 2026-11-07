/**
 * Sola may only state what the user actually said or logged (Ddk, Nov 7). Models sometimes add
 * plausible-sounding claims about the person's life ("after a difficult night", "your exam").
 * This check rejects generated text that makes a claim about the user's past or current situation
 * using a detail the source data never mentioned; the caller then uses a handwritten line instead.
 *
 * General suggestions for the future stay allowed even when they name such a detail:
 * "Maybe call a friend later" or "a short walk could help" claim nothing about the user.
 */

// Concrete life details a model tends to invent. Each group counts as logged if any of its words is.
const DETAIL_GROUPS: readonly (readonly string[])[] = [
  ['night', 'tonight', 'overnight'],
  ['sleep', 'slept', 'sleeping', 'insomnia', 'awake', 'woke', 'tired', 'exhausted'],
  ['exam', 'exams', 'test', 'tests', 'quiz', 'study', 'studying'],
  ['work', 'job', 'office', 'boss', 'shift', 'meeting', 'deadline', 'deadlines', 'project'],
  ['school', 'college', 'class', 'classes', 'lecture', 'teacher'],
  ['fight', 'argument', 'argued', 'quarrel', 'conflict'],
  ['friend', 'friends', 'partner', 'boyfriend', 'girlfriend', 'husband', 'wife', 'family', 'mom', 'mum', 'dad', 'parents', 'sister', 'brother'],
  ['party', 'trip', 'travel', 'holiday', 'vacation', 'wedding'],
  ['sick', 'ill', 'illness', 'pain', 'headache', 'fever', 'hospital', 'doctor'],
  ['weekend', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  ['difficult', 'rough', 'tough', 'stressful'],
];

/** Phrases that always describe the user's past or current situation, wherever they appear. */
const SITUATION_PHRASES = ['last night', 'hard day', 'bad day', 'long day', 'rough day', 'tough day', 'difficult day', 'difficult night', 'rough night', 'bad night', 'yesterday'];

// A detail framed by one of these (within a few words before it) is a claim about the user's own
// past or present: "your exam", "after a difficult night", "at work", "since Tuesday", "that fight".
const CLAIM_MARKERS = new Set([
  'your', 'youre', 'youve', 'yours', 'had', 'were', 'was', 'after', 'since', 'before', 'from', 'last',
  'that', 'this', 'those', 'such', 'at', 'about', 'during', 'through', 'over',
]);
const MARKER_WINDOW = 3;

const tokens = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

function groupOf(word: string): number {
  return DETAIL_GROUPS.findIndex((group) => group.includes(word));
}

/** The detail groups a text mentions at all (used for the source: anything logged is allowed). */
function mentioned(text: string): Set<number> {
  const found = new Set<number>();
  for (const word of tokens(text)) {
    const g = groupOf(word);
    if (g >= 0) found.add(g);
  }
  return found;
}

/**
 * True when `output` states something about the user's past or current situation that `source`
 * (everything the model was given) never mentioned. Mood words, notes, times and the goal are all
 * in the source, so "feeling low this morning" passes after a low morning check-in.
 */
export function inventsDetails(output: string, source: string): boolean {
  const allowed = mentioned(source);
  const sourceText = ` ${tokens(source).join(' ')} `;
  const words = tokens(output);
  const joined = ` ${words.join(' ')} `;

  // Fixed situation phrases are claims on their own ("after a rough night", "a long day").
  for (const phrase of SITUATION_PHRASES) {
    if (joined.includes(` ${phrase} `) && !sourceText.includes(` ${phrase} `)) {
      const g = groupOf(phrase.split(' ').at(-1) ?? '');
      if (g < 0 || !allowed.has(g)) return true;
    }
  }

  // Any other detail word counts only when framed as their own past or present situation.
  return words.some((word, i) => {
    const g = groupOf(word);
    if (g < 0 || allowed.has(g)) return false;
    return words.slice(Math.max(0, i - MARKER_WINDOW), i).some((w) => CLAIM_MARKERS.has(w));
  });
}
