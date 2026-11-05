import type { SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { cloudLayers, trees } from '../../theme/sky';
import { bakeCloud, bakeLandscape, bakeMoon, bakeTree, type Light } from './bake';
import type { SceneRect } from './landscape';
import { logPerf } from './perf';

export type SceneImages = Record<string, SkImage | null>;

const REST_DELAY_MS = 900; // Let the first screen settle before baking what isn't visible yet.
const GAP_MS = 24; // A breath between bakes, so taps stay responsive.

/**
 * Bakes the scene after the first frame, so the app appears immediately. What's on screen comes
 * first; the other times of day follow one at a time.
 */
export function useSceneImages(rect: SceneRect, screenWidth: number, ready: boolean, startsAtNight: boolean): SceneImages {
  const [images, setImages] = useState<SceneImages>({});

  useEffect(() => {
    if (!ready || rect.height <= 0) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const made: SceneImages = {};
    const half = screenWidth / 2;

    const forLight = (light: 'day' | 'night'): [string, () => SkImage | null][] => [
      [`landscape.${light}`, () => bakeLandscape(rect, light)],
      [`tree.left.${light}`, () => bakeTree(trees.left, rect, 11, 0, half, light)],
      [`tree.right.${light}`, () => bakeTree(trees.right, rect, 503, half, half, light)],
      ...cloudLayers.map((layer, i): [string, () => SkImage | null] => [`cloud.${i}.${light}`, () => bakeCloud(layer, light)]),
    ];
    const current: Light = startsAtNight ? 'night' : 'day';
    const other = startsAtNight ? 'day' : 'night';
    const first = [...forLight(current as 'day' | 'night'), ['moon', () => bakeMoon()]] as [string, () => SkImage | null][];
    const rest: [string, () => SkImage | null][] = [
      ...forLight(other),
      ['landscape.golden', () => bakeLandscape(rect, 'golden')],
    ];

    const run = (list: [string, () => SkImage | null][], done: () => void) => {
      let i = 0;
      const next = () => {
        if (cancelled) return;
        const task = list[i];
        i += 1;
        if (!task) {
          done();
          return;
        }
        const started = performance.now();
        made[task[0]] = task[1]();
        logPerf(`bake ${task[0]} ms=${(performance.now() - started).toFixed(0)}`);
        timer = setTimeout(next, GAP_MS);
      };
      next();
    };

    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        const started = performance.now();
        run(first, () => {
          logPerf(`visible-set ms=${(performance.now() - started).toFixed(0)} sinceStart=${performance.now().toFixed(0)}`);
          setImages({ ...made });
          timer = setTimeout(() => run(rest, () => setImages({ ...made })), REST_DELAY_MS);
        });
      }, 0);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [ready, rect, screenWidth, startsAtNight]);

  return images;
}
