/**
 * Sola may only use what the user actually said or logged (Ddk, Nov 7). Models sometimes add
 * plausible-sounding details ("after a difficult night", "before your exam"). This check rejects
 * generated text that mentions a concrete life detail the source data never mentioned; the caller
 * then uses a handwritten line instead.
 */

// Concrete details a model tends to invent. Each group counts as present if any of its words is.
const DETAIL_GROUPS: readonly (readonly string[])[] = [
  ['night', 'tonight', 'last night', 'overnight'],
  ['sleep', 'slept', 'sleeping', 'insomnia', 'awake', 'woke', 'tired', 'exhausted'],
  ['exam', 'exams', 'test', 'tests', 'quiz', 'study', 'studying'],
  ['work', 'job', 'office', 'boss', 'shift', 'meeting', 'deadline', 'deadlines', 'project'],
  ['school', 'college', 'class', 'classes', 'lecture', 'teacher'],
  ['fight', 'argument', 'argued', 'quarrel', 'conflict'],
  ['friend', 'friends', 'partner', 'boyfriend', 'girlfriend', 'husband', 'wife', 'family', 'mom', 'mum', 'dad', 'parents', 'sister', 'brother'],
  ['party', 'trip', 'travel', 'holiday', 'vacation', 'wedding'],
  ['sick', 'ill', 'illness', 'pain', 'headache', 'fever', 'hospital', 'doctor'],
  ['weekend', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  ['difficult', 'rough', 'tough', 'hard day', 'bad day', 'stressful'],
];

const words = (text: string) => ` ${text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ')} `;

/** The detail groups a text mentions. */
function mentioned(text: string): Set<number> {
  const w = words(text);
  const found = new Set<number>();
  DETAIL_GROUPS.forEach((group, i) => {
    if (group.some((word) => w.includes(` ${word} `))) found.add(i);
  });
  return found;
}

/**
 * True when `output` mentions a detail group that `source` (everything the model was given)
 * never mentions. Mood words and the user's goal are part of the source, so "a low evening"
 * after logging a low mood in the evening passes; "a difficult night" after a morning check-in
 * with no note does not.
 */
export function inventsDetails(output: string, source: string): boolean {
  const allowed = mentioned(source);
  for (const group of mentioned(output)) if (!allowed.has(group)) return true;
  return false;
}
