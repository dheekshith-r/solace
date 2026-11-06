const sent: unknown[] = [];
jest.mock('../../auth/session', () => ({
  useSession: { getState: () => ({ user: { id: 'u1' } }) },
  authed: jest.fn(async (_path: string, options: { body: unknown }) => {
    sent.push(options.body);
    return { suggestion: { text: 'A slow exhale could help.', action: 'breathe' } };
  }),
}));
jest.mock('react-native-mmkv', () => {
  const data = new Map<string, string>();
  return {
    createMMKV: () => ({
      getString: (k: string) => data.get(k),
      set: (k: string, v: string) => data.set(k, v),
      remove: (k: string) => data.delete(k),
      clearAll: () => data.clear(),
    }),
  };
});

describe('mood saving on Today', () => {
  it('sends one check-in with the last of several quick taps', async () => {
    jest.useFakeTimers();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { queueMood } = require('../data') as typeof import('../data');
    queueMood(2);
    await jest.advanceTimersByTimeAsync(500);
    queueMood(4);
    await jest.advanceTimersByTimeAsync(500);
    queueMood(5);
    await jest.advanceTimersByTimeAsync(2000);
    expect(sent).toEqual([{ mood: 5, source: 'home' }]);
    jest.useRealTimers();
  });
});
