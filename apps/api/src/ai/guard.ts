import { AiError } from './client';

/**
 * Runs a model call with a deadline. The call gets an AbortSignal that fires on the deadline or
 * when `outer` aborts; the promise rejects with AiError('timeout') on the deadline even if the
 * provider ignores the signal.
 */
export async function withDeadline<T>(
  ms: number,
  call: (signal: AbortSignal) => Promise<T>,
  outer?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const signal = outer ? AbortSignal.any([outer, controller.signal]) : controller.signal;
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AiError('timeout'));
    }, ms);
  });
  const work = call(signal);
  work.catch(() => {});
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wraps a text stream: the first chunk must arrive within `firstMs` and each later one within
 * `idleMs`, or it throws AiError('timeout') and aborts `controller` so the provider stops.
 */
export async function* guardStream(
  source: AsyncIterable<string>,
  { firstMs, idleMs, controller }: { firstMs: number; idleMs: number; controller: AbortController },
): AsyncGenerator<string> {
  const iterator = source[Symbol.asyncIterator]();
  let first = true;
  try {
    while (true) {
      let timer: NodeJS.Timeout | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new AiError('timeout'));
        }, first ? firstMs : idleMs);
      });
      const next = iterator.next();
      next.catch(() => {});
      let result: IteratorResult<string>;
      try {
        result = await Promise.race([next, deadline]);
      } finally {
        clearTimeout(timer);
      }
      if (result.done) return;
      first = false;
      yield result.value;
    }
  } finally {
    // Stops the provider stream if we leave early (timeout, client gone, error).
    iterator.return?.()?.catch(() => {});
  }
}
