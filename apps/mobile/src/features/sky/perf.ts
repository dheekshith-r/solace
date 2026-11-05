// Hidden measurement tools, on only when Today opens with ?perf=1. Results go to the device log.

export const perfSettings = { enabled: false, rasterBake: false };

export function configurePerf(enabled: boolean, rasterBake: boolean) {
  perfSettings.enabled = enabled;
  perfSettings.rasterBake = rasterBake;
}

export function logPerf(message: string) {
  if (perfSettings.enabled) console.log(`PERF ${message}`);
}

export type FrameWindow = { frames: number; total: number; over9: number; over17: number; over34: number; worst: number; started: number };

export const emptyFrameWindow = (started: number): FrameWindow => ({
  frames: 0,
  total: 0,
  over9: 0,
  over17: 0,
  over34: 0,
  worst: 0,
  started,
});

/** Adds one frame gap, in ms, to a window. Pure, so it can run on the UI thread and in tests. */
export function addFrame(w: FrameWindow, gap: number): FrameWindow {
  'worklet';
  return {
    frames: w.frames + 1,
    total: w.total + gap,
    over9: w.over9 + (gap > 9 ? 1 : 0),
    over17: w.over17 + (gap > 17 ? 1 : 0),
    over34: w.over34 + (gap > 34 ? 1 : 0),
    worst: Math.max(w.worst, gap),
    started: w.started,
  };
}

export function describeWindow(w: FrameWindow): string {
  const fps = w.total > 0 ? (w.frames * 1000) / w.total : 0;
  return `frames fps=${fps.toFixed(1)} n=${w.frames} over9=${w.over9} over17=${w.over17} over34=${w.over34} worst=${w.worst.toFixed(1)}`;
}
