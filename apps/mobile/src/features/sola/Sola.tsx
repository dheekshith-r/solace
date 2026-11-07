import { Canvas, Circle, Group, Oval, Path, RadialGradient, Skia, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { isLite } from '../../lib/device';
import { duration, easing } from '../../theme/motion';
import { sola } from '../../theme/sky';

const BODY = 'M100 30 C148 30 178 66 178 112 C178 156 146 180 100 180 C54 180 22 156 22 112 C22 66 52 30 100 30 Z';
const LEAF = 'M101 32 C92 18 99 6 113 5 C117 18 112 28 101 32 Z';
const WAVE_TILT = 0.14; // Radians each way.
const WAVE_SWINGS = 3;
const WAVE_STEP_MS = 260;

const mouthFor = (mood: number) => Skia.Path.MakeFromSVGString(`M86 130 Q100 ${132 + (mood - 3) * sola.mouthCurve} 114 130`) ?? Skia.Path.Make();

/**
 * Sola on its own, for every screen except Today (which draws Sola inside its scene). Same shapes and
 * colors as Today. `waving` tilts Sola side to side a few times, like a hello. It floats gently unless
 * reduce motion or lite mode is on.
 */
/**
 * `tight`: the layout box is just Sola's body, and the glow spills softly past it, for rows where
 * Sola sits beside text (the Sola tab card, the chat header). Otherwise the box includes the glow.
 */
export function SolaFigure({ size, glow = 'day', mood = 4, waving = false, tight = false }: { size: number; glow?: 'day' | 'night'; mood?: number; waving?: boolean; tight?: boolean }) {
  const reduced = useReducedMotion();
  const still = reduced || isLite;
  const glowRadius = size * sola.glowRatio;
  const box = glowRadius * 2;
  const scale = size / sola.viewBox;

  const float = useSharedValue(0);
  const tilt = useSharedValue(0);
  useEffect(() => {
    if (still) return undefined;
    float.set(withRepeat(withTiming(1, { duration: (sola.floatPeriod * 1000) / 2, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(float);
  }, [float, still]);
  useEffect(() => {
    if (!waving || still) return;
    const swing = (to: number) => withTiming(to, { duration: WAVE_STEP_MS, easing });
    const swings = Array.from({ length: WAVE_SWINGS }, () => [swing(WAVE_TILT), swing(-WAVE_TILT)]).flat();
    tilt.set(withDelay(duration.entrance, withSequence(...swings, swing(0))));
  }, [tilt, waving, still]);

  const body = useDerivedValue(() => [
    { translateX: box / 2 },
    { translateY: box / 2 + (float.get() * 2 - 1) * sola.floatDistance },
    { rotate: tilt.get() },
    { scale },
    { translateX: -sola.viewBox / 2 },
    { translateY: -sola.viewBox / 2 },
  ]);
  const blush = sola.blushLow + ((sola.blushHigh - sola.blushLow) * (mood - 1)) / 4;
  const eyeScale = sola.eyeLow + ((1 - sola.eyeLow) * (mood - 1)) / 4;

  return (
    <View
      style={tight ? { width: size, height: size } : { width: box, height: box }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Sola, a small glowing friend"
    >
      <Canvas style={tight ? { position: 'absolute', width: box, height: box, left: (size - box) / 2, top: (size - box) / 2 } : StyleSheet.absoluteFill}>
        <Circle cx={box / 2} cy={box / 2} r={glowRadius}>
          <RadialGradient c={vec(box / 2, box / 2)} r={glowRadius} colors={[...(glow === 'day' ? sola.glowDay : sola.glowNight)]} />
        </Circle>
        <Group transform={body}>
          <Path path={BODY}>
            <RadialGradient c={vec(76, 60)} r={156} colors={[...sola.body]} positions={[...sola.bodyStops]} />
          </Path>
          <Path path={LEAF} color={sola.body[2]} />
          <Oval x={45} y={116} width={26} height={16} color={sola.cheek} opacity={blush} />
          <Oval x={129} y={116} width={26} height={16} color={sola.cheek} opacity={blush} />
          <Group transform={[{ translateY: sola.eyeY }, { scaleY: eyeScale }, { translateY: -sola.eyeY }]}>
            <Oval x={67} y={94} width={16} height={20} color={sola.ink} />
            <Oval x={117} y={94} width={16} height={20} color={sola.ink} />
            <Circle cx={78} cy={100} r={2.8} color={sola.body[0]} />
            <Circle cx={128} cy={100} r={2.8} color={sola.body[0]} />
          </Group>
          <Path path={mouthFor(mood)} style="stroke" strokeWidth={5} strokeCap="round" color={sola.ink} />
        </Group>
      </Canvas>
    </View>
  );
}
