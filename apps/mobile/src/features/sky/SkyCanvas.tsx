import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  cloudLayers,
  cloudPuffs,
  constellation,
  skyColor,
  skyLayout,
  skyMotion,
  skyStopPositions,
  sola,
} from '../../theme/sky';
import { isSleepy, moonLitPath, moonProgress, sunProgress } from './astro';
import { nightAmount, rgbToCss, skyStops } from './skyColors';

const TWO_PI = Math.PI * 2;

type Size = { width: number; height: number };

function seeded(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function arcPoint(progress: number, size: Size): { x: number; y: number } {
  'worklet';
  const { arcLeft, arcRight, horizon, arcApex } = skyLayout;
  return {
    x: size.width * (arcLeft + (arcRight - arcLeft) * progress),
    y: size.height * (horizon - Math.sin(Math.PI * progress) * (horizon - arcApex)),
  };
}

function Star({ x, y, r, period, phase, clock, night }: {
  x: number;
  y: number;
  r: number;
  period: number;
  phase: number;
  clock: SharedValue<number>;
  night: SharedValue<number>;
}) {
  const opacity = useDerivedValue(() => {
    const n = night.get();
    if (n <= 0) return 0;
    return n * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin((TWO_PI * clock.get()) / period + phase)));
  });
  return <Circle cx={x} cy={y} r={r} color={skyColor.star} opacity={opacity} />;
}

function CloudLayer({ layer, size, clock, minute }: {
  layer: (typeof cloudLayers)[number];
  size: Size;
  clock: SharedValue<number>;
  minute: SharedValue<number>;
}) {
  const span = size.width + 200;
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    [0, 0.52].forEach((at, index) => {
      const cx = span * at;
      const shrink = index === 0 ? 1 : 0.78;
      cloudPuffs.forEach((puff) => {
        builder.addCircle(cx + puff.x * layer.scale * shrink, puff.y * layer.scale * shrink, puff.r * layer.scale * shrink);
      });
    });
    return builder.build();
  }, [layer.scale, span]);

  const transform = useDerivedValue(() => {
    const x = ((clock.get() * layer.speed + span * layer.offset) % span) - 100;
    return [{ translateX: x }, { translateY: size.height * layer.y }];
  });
  const opacity = useDerivedValue(() => {
    const n = nightAmount(minute.get());
    return layer.opacity * (skyColor.cloudDayOpacity + (skyColor.cloudNightOpacity - skyColor.cloudDayOpacity) * n);
  });

  return (
    <Group transform={transform}>
      <Path path={path} color={skyColor.cloud} opacity={opacity}>
        <BlurMask blur={5} style="normal" />
      </Path>
      <Group transform={[{ translateX: -span }]}>
        <Path path={path} color={skyColor.cloud} opacity={opacity}>
          <BlurMask blur={5} style="normal" />
        </Path>
      </Group>
    </Group>
  );
}

function Sun({ minute, size }: { minute: SharedValue<number>; size: Size }) {
  const transform = useDerivedValue(() => {
    const p = arcPoint(Math.min(1, Math.max(0, sunProgress(minute.get()))), size);
    return [{ translateX: p.x }, { translateY: p.y }];
  });
  const opacity = useDerivedValue(() => {
    const progress = sunProgress(minute.get());
    if (progress < 0 || progress > 1) return 0;
    return Math.min(1, Math.sin(Math.PI * progress) * 4);
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={skyColor.sunRadius}>
        <RadialGradient c={vec(0, 0)} r={skyColor.sunRadius} colors={[...skyColor.sun]} positions={[0.32, 0.42, 1]} />
      </Circle>
    </Group>
  );
}

function Moon({ minute, phase, size }: { minute: SharedValue<number>; phase: number; size: Size }) {
  const lit = useMemo(
    () => Skia.Path.MakeFromSVGString(moonLitPath(phase, skyColor.moonRadius)),
    [phase],
  );
  const transform = useDerivedValue(() => {
    const p = arcPoint(moonProgress(minute.get()), size);
    return [{ translateX: p.x }, { translateY: p.y }];
  });
  const opacity = useDerivedValue(() => nightAmount(minute.get()));
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={skyColor.moonRadius} color={skyColor.moonDark} />
      {lit ? <Path path={lit} color={skyColor.moon} /> : null}
    </Group>
  );
}

function ShootingStar({ clock, startedAt, size, night }: {
  clock: SharedValue<number>;
  startedAt: SharedValue<number>;
  size: Size;
  night: SharedValue<number>;
}) {
  const progress = useDerivedValue(() => {
    const p = (clock.get() - startedAt.get()) / skyMotion.shootingDuration;
    return p >= 0 && p <= 1 ? p : -1;
  });
  const startX = size.width * 0.72;
  const startY = size.height * 0.3;
  const head = useDerivedValue(() => {
    const p = Math.max(0, progress.get());
    return vec(startX - p * skyMotion.shootingLength * 2, startY + p * skyMotion.shootingLength);
  });
  const tail = useDerivedValue(() => {
    const p = Math.max(0, progress.get() - 0.25);
    return vec(startX - p * skyMotion.shootingLength * 2, startY + p * skyMotion.shootingLength);
  });
  const opacity = useDerivedValue(() => {
    const p = progress.get();
    return p < 0 || night.get() < 0.6 ? 0 : Math.sin(Math.PI * p) * 0.9;
  });
  return <Line p1={tail} p2={head} color={skyColor.shootingStar} strokeWidth={1.4} strokeCap="round" opacity={opacity} />;
}

function Constellation({ size, days, night }: { size: Size; days: number; night: SharedValue<number> }) {
  const points = constellation.slice(0, days).map((p) => vec(p.x * size.width, p.y * size.height));
  const lineOpacity = useDerivedValue(() => night.get() * 0.34);
  const starOpacity = useDerivedValue(() => night.get());
  return (
    <>
      {points.slice(1).map((p, i) => (
        <Line
          key={`line-${p.x}`}
          p1={points[i] ?? p}
          p2={p}
          color={skyColor.star}
          strokeWidth={0.8}
          opacity={lineOpacity}
        />
      ))}
      {points.map((p) => (
        <Circle key={`star-${p.x}`} c={p} r={2.2} color={skyColor.star} opacity={starOpacity} />
      ))}
    </>
  );
}

function SolaCloud({ size, mood, solaY, clock, minute, night, moving }: {
  size: Size;
  mood: SharedValue<number>;
  solaY: SharedValue<number>;
  clock: SharedValue<number>;
  minute: SharedValue<number>;
  night: SharedValue<number>;
  moving: boolean;
}) {
  const heaviness = useDerivedValue(() => Math.min(1, Math.max(0, (3 - mood.get()) / 2)));

  const body = useDerivedValue(() => {
    const h = heaviness.get();
    const shrink = 1 - sola.heavyShrink * h;
    const builder = Skia.PathBuilder.Make();
    sola.puffs.forEach((puff) => {
      builder.addCircle(puff.x * (1 + 0.06 * h), puff.y + sola.heavySag * h, puff.r * shrink);
    });
    return builder.build();
  });

  const transform = useDerivedValue(() => {
    const float = moving ? Math.sin((TWO_PI * clock.get()) / sola.floatPeriod) * sola.floatDistance : 0;
    return [{ translateX: size.width * skyLayout.solaX }, { translateY: solaY.get() + float }];
  });

  const bodyColors = useDerivedValue(() => {
    const h = heaviness.get();
    const mix = (a: string, b: string) => {
      const pa = parseInt(a.slice(1), 16);
      const pb = parseInt(b.slice(1), 16);
      const channel = (shift: number) => {
        const from = (pa >> shift) & 255;
        const to = (pb >> shift) & 255;
        return Math.round(from + (to - from) * h);
      };
      return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
    };
    return [mix(sola.bright[0], sola.heavy[0]), mix(sola.bright[1], sola.heavy[1])];
  });

  const rimOpacity = useDerivedValue(() => night.get());
  const glowOpacity = useDerivedValue(() => night.get());
  const awakeOpacity = useDerivedValue(() => (isSleepy(minute.get()) ? 0 : 1));
  const sleepyOpacity = useDerivedValue(() => (isSleepy(minute.get()) ? 1 : 0));

  const mouth = useDerivedValue(() => {
    const curve = (mood.get() - 3) * 3;
    return Skia.Path.MakeFromSVGString(`M-7 12 Q0 ${12 + curve} 7 12`) ?? Skia.Path.Make();
  });

  const sleepyEyes = useMemo(() => Skia.Path.MakeFromSVGString('M-21 -3 Q-15 3 -9 -3 M9 -3 Q15 3 21 -3') ?? Skia.Path.Make(), []);

  return (
    <Group transform={transform}>
      <Circle cx={0} cy={0} r={sola.glowRadius} opacity={glowOpacity}>
        <RadialGradient c={vec(0, 0)} r={sola.glowRadius} colors={[...sola.glow]} />
      </Circle>

      <Group transform={[{ scale: sola.rimScale }]}>
        <Path path={body} color={sola.silver} opacity={rimOpacity} />
      </Group>
      <Path path={body}>
        <LinearGradient start={vec(0, -40)} end={vec(0, 40)} colors={bodyColors} />
      </Path>

      {[-28, -14, 0, 14, 28].map((x, index) => (
        <Drizzle key={x} x={x} index={index} clock={clock} heaviness={heaviness} />
      ))}

      <Circle cx={-27} cy={10} r={7} color={sola.cheek} opacity={sola.cheekOpacity} />
      <Circle cx={27} cy={10} r={7} color={sola.cheek} opacity={sola.cheekOpacity} />

      <Group opacity={awakeOpacity}>
        <Circle cx={-15} cy={-2} r={3.6} color={sola.ink} />
        <Circle cx={15} cy={-2} r={3.6} color={sola.ink} />
      </Group>
      <Path path={sleepyEyes} style="stroke" strokeWidth={2.6} strokeCap="round" color={sola.ink} opacity={sleepyOpacity} />
      <Path path={mouth} style="stroke" strokeWidth={2.6} strokeCap="round" color={sola.ink} />
    </Group>
  );
}

function Drizzle({ x, index, clock, heaviness }: {
  x: number;
  index: number;
  clock: SharedValue<number>;
  heaviness: SharedValue<number>;
}) {
  const travel = 26;
  const y = useDerivedValue(() => 42 + ((clock.get() * skyMotion.drizzleSpeed + index * 9) % travel));
  const p1 = useDerivedValue(() => vec(x, y.get()));
  const p2 = useDerivedValue(() => vec(x - 1.5, y.get() + 7));
  const opacity = useDerivedValue(() => {
    const fade = 1 - ((y.get() - 42) / travel) * 0.7;
    return Math.max(0, heaviness.get() - 0.2) * 1.2 * fade;
  });
  return <Line p1={p1} p2={p2} color={sola.drizzle} strokeWidth={1.8} strokeCap="round" opacity={opacity} />;
}

export function SkyCanvas({ size, minute, mood, solaY, clock, shootingStartedAt, moonPhaseValue, streakDays, lite, moving }: {
  size: Size;
  minute: SharedValue<number>;
  mood: SharedValue<number>;
  solaY: SharedValue<number>;
  clock: SharedValue<number>;
  shootingStartedAt: SharedValue<number>;
  moonPhaseValue: number;
  streakDays: number;
  lite: boolean;
  moving: boolean;
}) {
  const colors = useDerivedValue(() => skyStops(minute.get(), mood.get()).map(rgbToCss));
  const night = useDerivedValue(() => nightAmount(minute.get()));

  const stars = useMemo(() => {
    const count = lite ? skyMotion.starCountLite : skyMotion.starCount;
    const { starMinPeriod, starMaxPeriod, starMinRadius, starMaxRadius } = skyMotion;
    const top = skyLayout.contentTop;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: seeded(i + 1) * size.width,
      y: size.height * (top + seeded(i + 41) * (skyLayout.horizon + 0.14 - top)),
      r: starMinRadius + seeded(i + 83) * (starMaxRadius - starMinRadius),
      period: starMinPeriod + seeded(i + 127) * (starMaxPeriod - starMinPeriod),
      phase: seeded(i + 173) * TWO_PI,
    }));
  }, [lite, size.height, size.width]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={size.width} height={size.height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, size.height)}
          colors={colors}
          positions={[...skyStopPositions]}
        />
      </Rect>

      {stars.map((s) => (
        <Star key={s.id} x={s.x} y={s.y} r={s.r} period={s.period} phase={s.phase} clock={clock} night={night} />
      ))}
      <Constellation size={size} days={streakDays} night={night} />
      <Moon minute={minute} phase={moonPhaseValue} size={size} />
      <Sun minute={minute} size={size} />
      {cloudLayers.map((layer) => (
        <CloudLayer key={layer.y} layer={layer} size={size} clock={clock} minute={minute} />
      ))}
      <ShootingStar clock={clock} startedAt={shootingStartedAt} size={size} night={night} />
      <SolaCloud
        size={size}
        mood={mood}
        solaY={solaY}
        clock={clock}
        minute={minute}
        night={night}
        moving={moving}
      />
    </Canvas>
  );
}
