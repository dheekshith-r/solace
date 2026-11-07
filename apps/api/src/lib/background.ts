import type { FastifyBaseLogger } from 'fastify';

/**
 * Work that runs after a response has been sent (conversation summaries). Failures are logged by
 * name only. `drain()` waits for everything in flight; the app calls it on close.
 */
export function createBackgroundTasks() {
  const pending = new Set<Promise<void>>();

  function run(name: string, log: FastifyBaseLogger, task: () => Promise<void>) {
    const promise = (async () => {
      try {
        await task();
      } catch (error) {
        log.warn(
          { task: name, errName: error instanceof Error ? error.name : 'unknown' },
          'background task failed',
        );
      }
    })();
    pending.add(promise);
    void promise.finally(() => pending.delete(promise));
  }

  async function drain() {
    while (pending.size > 0) await Promise.all([...pending]);
  }

  return { run, drain, get size() { return pending.size; } };
}

export type BackgroundTasks = ReturnType<typeof createBackgroundTasks>;
