export type PhaseKind = 'in' | 'hold' | 'out' | 'rest';
export type Phase = { kind: PhaseKind; label: string; seconds: number };
export type PatternKey = 'calm' | 'box' | 'sleep';

export const ROUNDS = 4;

/** The three patterns (spec 8.7). Each phase says what to do in plain words. */
export const PATTERNS: Record<PatternKey, { name: string; detail: string; phases: Phase[] }> = {
  calm: {
    name: 'Calm',
    detail: 'In 4, hold 4, out 6',
    phases: [
      { kind: 'in', label: 'Breathe in', seconds: 4 },
      { kind: 'hold', label: 'Hold', seconds: 4 },
      { kind: 'out', label: 'Breathe out', seconds: 6 },
    ],
  },
  box: {
    name: 'Box',
    detail: 'In 4, hold 4, out 4, hold 4',
    phases: [
      { kind: 'in', label: 'Breathe in', seconds: 4 },
      { kind: 'hold', label: 'Hold', seconds: 4 },
      { kind: 'out', label: 'Breathe out', seconds: 4 },
      { kind: 'rest', label: 'Hold', seconds: 4 },
    ],
  },
  sleep: {
    name: 'Sleep',
    detail: 'In 4, hold 7, out 8',
    phases: [
      { kind: 'in', label: 'Breathe in', seconds: 4 },
      { kind: 'hold', label: 'Hold', seconds: 7 },
      { kind: 'out', label: 'Breathe out', seconds: 8 },
    ],
  },
};

/** Every phase of a session, in order: the pattern repeated for ROUNDS rounds. */
export function timeline(key: PatternKey): (Phase & { round: number })[] {
  return Array.from({ length: ROUNDS }, (_, r) => PATTERNS[key].phases.map((p) => ({ ...p, round: r + 1 }))).flat();
}

export function totalSeconds(key: PatternKey): number {
  return timeline(key).reduce((sum, p) => sum + p.seconds, 0);
}

/** How large the orb is at the end of a phase: full after breathing in and while holding it. */
export function orbTarget(kind: PhaseKind): number {
  return kind === 'in' || kind === 'hold' ? 1 : 0;
}
