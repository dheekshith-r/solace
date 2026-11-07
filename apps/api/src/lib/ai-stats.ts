/**
 * Aggregate reply-model counts since the process started, for GET /health/ai.
 * Totals only: nothing per user, no message content.
 */
export function createAiStats() {
  const counts = { replies: 0, primary503: 0, fallbacks: 0 };
  return {
    /** One finished reply attempt (answered or failed). */
    record(reply: { primary503s: number; fellBack: boolean }) {
      counts.replies += 1;
      counts.primary503 += reply.primary503s;
      if (reply.fellBack) counts.fallbacks += 1;
    },
    snapshot() {
      return { ...counts };
    },
  };
}

export type AiStats = ReturnType<typeof createAiStats>;
