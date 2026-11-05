import {
  BlurMask,
  Canvas,
  Circle,
  createPicture,
  Group,
  Line,
  LinearGradient,
  Oval,
  Path,
  PathOp,
  Picture,
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
  owlColor,
  owlTimeline,
  petals,
  sceneColor,
  sceneShapes,
  skyColor,
  skyMotion,
  skyStopPositions,
  sola,
} from '../../theme/sky';
import { isSleepy, moonLitPath } from './astro';
import { owlPose, scenePaths, type SceneRect } from './landscape';
import { nightAmount, rgbToCss, timeStops } from './skyColors';

const TWO_PI = Math.PI * 2;
const CLOUD_MARGIN = 100;
const STAR_SCENE_SHARE = 0.55;

type Size = { width: number; height: number };

// The parts of the screen with no text behind them.
export type SkyBands = {
  dateBottom: number;
  solaCenterY: number;
  solaSize: number;
  scene: SceneRect;
};

function seeded(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
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

function CloudLayer({ layer, y, width, clock, minute }: {
  layer: (typeof cloudLayers)[number];
  y: number;
  width: number;
  clock: SharedValue<number>;
  minute: SharedValue<number>;
}) {
  const span = width + CLOUD_MARGIN * 2;
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
    const x = ((clock.get() * layer.speed + span * layer.offset) % span) - CLOUD_MARGIN;
    return [{ translateX: x }, { translateY: y }];
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

function Sun({ x, y, night }: { x: number; y: number; night: SharedValue<number> }) {
  const opacity = useDerivedValue(() => 1 - night.get());
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]} opacity={opacity}>
      <Circle cx={0} cy={0} r={skyColor.sunRadius}>
        <RadialGradient c={vec(0, 0)} r={skyColor.sunRadius} colors={[...skyColor.sun]} positions={[0.32, 0.42, 1]} />
      </Circle>
    </Group>
  );
}

function Moon({ x, y, phase, night }: { x: number; y: number; phase: number; night: SharedValue<number> }) {
  const lit = useMemo(() => Skia.Path.MakeFromSVGString(moonLitPath(phase, skyColor.moonRadius)), [phase]);
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]} opacity={night}>
      <Circle cx={0} cy={0} r={skyColor.moonRadius} color={skyColor.moonDark} />
      {lit ? <Path path={lit} color={skyColor.moon} /> : null}
    </Group>
  );
}

function ShootingStar({ clock, startedAt, startX, startY, night }: {
  clock: SharedValue<number>;
  startedAt: SharedValue<number>;
  startX: number;
  startY: number;
  night: SharedValue<number>;
}) {
  const progress = useDerivedValue(() => {
    const p = (clock.get() - startedAt.get()) / skyMotion.shootingDuration;
    return p >= 0 && p <= 1 ? p : -1;
  });
  const head = useDerivedValue(() => {
    const p = Math.max(0, progress.get());
    return vec(startX - p * skyMotion.shootingLength * 2, startY + p * skyMotion.shootingLength * 0.6);
  });
  const tail = useDerivedValue(() => {
    const p = Math.max(0, progress.get() - 0.25);
    return vec(startX - p * skyMotion.shootingLength * 2, startY + p * skyMotion.shootingLength * 0.6);
  });
  const opacity = useDerivedValue(() => {
    const p = progress.get();
    return p < 0 || night.get() < 0.6 ? 0 : Math.sin(Math.PI * p) * 0.9;
  });
  return <Line p1={tail} p2={head} color={skyColor.shootingStar} strokeWidth={1.4} strokeCap="round" opacity={opacity} />;
}

/** The static scene: drawn once into a cached picture, with one overlay for night. */
function StaticScene({ rect, night }: { rect: SceneRect; night: SharedValue<number> }) {
  const { picture, silhouette } = useMemo(() => {
    const paths = scenePaths(rect);
    const toPath = (d: string) => Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();
    const mountain = toPath(paths.mountain);
    const hillFar = toPath(paths.hillFar);
    const hillNear = toPath(paths.hillNear);
    const stream = toPath(paths.stream);
    const branchLeft = toPath(paths.branchLeft);
    const branchRight = toPath(paths.branchRight);

    const pic = createPicture((canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      const fill = (path: ReturnType<typeof toPath>, color: string, opacity: number) => {
        paint.setShader(null);
        paint.setColor(Skia.Color(color));
        paint.setAlphaf(opacity);
        canvas.drawPath(path, paint);
      };

      // The mountain fades into haze at its base.
      paint.setAlphaf(1);
      paint.setShader(
        Skia.Shader.MakeLinearGradient(
          vec(0, rect.top + rect.height * 0.3),
          vec(0, rect.top + rect.height * 0.74),
          [Skia.Color(sceneColor.mountain), Skia.Color(sceneColor.mountainFade)],
          null,
          0,
        ),
      );
      canvas.drawPath(mountain, paint);
      fill(toPath(paths.snow), sceneColor.snow, 0.92);
      fill(hillFar, sceneColor.hill, sceneColor.hillFarOpacity);
      fill(stream, sceneColor.stream, sceneColor.streamOpacity);
      fill(hillNear, sceneColor.hill, sceneColor.hillNearOpacity);
      fill(stream, sceneColor.stream, sceneColor.streamOpacity);
      fill(branchLeft, sceneColor.branch, 1);
      fill(branchRight, sceneColor.branch, 1);
      paint.setColor(Skia.Color(sceneColor.blossom));
      paint.setAlphaf(sceneColor.blossomOpacity);
      sceneShapes.blossoms.forEach(([x, y, r]) => {
        canvas.drawCircle(x * rect.width, rect.top + y * rect.height, r, paint);
      });
    });

    const union = [hillFar, hillNear, branchLeft, branchRight].reduce(
      (all, next) => Skia.Path.MakeFromOp(all, next, PathOp.Union) ?? all,
      mountain,
    );
    return { picture: pic, silhouette: union };
  }, [rect]);

  const overlay = useDerivedValue(() => night.get() * sceneColor.nightOverlayOpacity);

  return (
    <>
      <Picture picture={picture} />
      <Path path={silhouette} color={sceneColor.nightOverlay} opacity={overlay} />
    </>
  );
}

function Shimmer({ x, y, width, index, clock }: {
  x: number;
  y: number;
  width: number;
  index: number;
  clock: SharedValue<number>;
}) {
  const opacity = useDerivedValue(() => 0.14 + 0.5 * (0.5 + 0.5 * Math.sin(clock.get() * 0.9 + index * 1.7)));
  return (
    <Line
      p1={vec(x - width / 2, y)}
      p2={vec(x + width / 2, y)}
      color={sceneColor.shimmer}
      strokeWidth={1.2}
      strokeCap="round"
      opacity={opacity}
    />
  );
}

function Petal({ index, rect, clock, night }: {
  index: number;
  rect: SceneRect;
  clock: SharedValue<number>;
  night: SharedValue<number>;
}) {
  const startX = seeded(index + 211) * rect.width;
  const offset = seeded(index + 257) * rect.height;
  const phase = seeded(index + 293) * TWO_PI;
  const speed = petals.fallSpeed * (0.8 + seeded(index + 331) * 0.4);

  const transform = useDerivedValue(() => {
    const t = clock.get();
    const y = rect.top + ((t * speed + offset) % rect.height);
    const x = startX + Math.sin(t * petals.swaySpeed + phase) * petals.swayDistance;
    return [{ translateX: x }, { translateY: y }, { rotate: t * petals.spinSpeed + phase }];
  });
  const opacity = useDerivedValue(() => {
    const n = night.get();
    return sceneColor.petalOpacity + (sceneColor.petalNightOpacity - sceneColor.petalOpacity) * n;
  });

  return (
    <Group transform={transform}>
      <Oval x={-petals.size} y={-petals.size / 2} width={petals.size * 2} height={petals.size} color={sceneColor.petal} opacity={opacity} />
    </Group>
  );
}

function Owl({ rect, clock, startedAt }: { rect: SceneRect; clock: SharedValue<number>; startedAt: SharedValue<number> }) {
  const pose = useDerivedValue(() => {
    const start = startedAt.get();
    return owlPose(start < 0 ? -1 : clock.get() - start);
  });
  const transform = useDerivedValue(() => {
    const p = pose.get();
    return [
      { translateX: p.x * rect.width },
      { translateY: rect.top + p.y * rect.height },
      { scale: p.scale * owlTimeline.size },
    ];
  });
  const opacity = useDerivedValue(() => pose.get().opacity);
  const leftWing = useDerivedValue(() => [{ rotate: (pose.get().wing * Math.PI) / 180 }]);
  const rightWing = useDerivedValue(() => [{ rotate: (-pose.get().wing * Math.PI) / 180 }]);
  // Looking along the branch, the head points left. Looking at the user, it faces front.
  const head = useDerivedValue(() => [{ translateX: (1 - pose.get().look) * -3 }]);
  const pupil = useDerivedValue(() => [{ translateX: (1 - pose.get().look) * -1.6 }]);
  const eyes = useDerivedValue(() => [{ translateY: -10 }, { scaleY: Math.max(0.08, pose.get().eyeOpen) }, { translateY: 10 }]);

  return (
    <Group transform={transform} opacity={opacity}>
      <Group transform={leftWing} origin={vec(-9, 2)}>
        <Oval x={-23} y={-3} width={17} height={22} color={owlColor.wing} />
      </Group>
      <Group transform={rightWing} origin={vec(9, 2)}>
        <Oval x={6} y={-3} width={17} height={22} color={owlColor.wing} />
      </Group>
      <Oval x={-11} y={-6} width={22} height={28} color={owlColor.body} />
      <Oval x={-7} y={2} width={14} height={18} color={owlColor.belly} />
      <Group transform={head}>
        <Path path="M-12 -19 L-9 -28 L-4 -21 Z M12 -19 L9 -28 L4 -21 Z" color={owlColor.body} />
        <Circle cx={0} cy={-13} r={12} color={owlColor.body} />
        <Group transform={eyes}>
          <Circle cx={-5} cy={-14} r={4} color={owlColor.eye} />
          <Circle cx={5} cy={-14} r={4} color={owlColor.eye} />
          <Group transform={pupil}>
            <Circle cx={-5} cy={-14} r={2} color={owlColor.pupil} />
            <Circle cx={5} cy={-14} r={2} color={owlColor.pupil} />
          </Group>
        </Group>
        <Path path="M-2 -10 L2 -10 L0 -6 Z" color={owlColor.beak} />
      </Group>
    </Group>
  );
}

function Sola({ cx, cy, size, mood, minute, night }: {
  cx: number;
  cy: number;
  size: number;
  mood: SharedValue<number>;
  minute: SharedValue<number>;
  night: SharedValue<number>;
}) {
  const scale = size / sola.viewBox;
  const glowRadius = size * sola.glowRatio;
  const dayGlow = useDerivedValue(() => 1 - night.get());
  const awake = useDerivedValue(() => (isSleepy(minute.get()) ? 0 : 1));
  const sleeping = useDerivedValue(() => (isSleepy(minute.get()) ? 1 : 0));
  const mouth = useDerivedValue(() => {
    const y = 132 + (mood.get() - 3) * 9;
    return Skia.Path.MakeFromSVGString(`M86 130 Q100 ${y} 114 130`) ?? Skia.Path.Make();
  });

  return (
    <Group transform={[{ translateX: cx }, { translateY: cy }]}>
      <Circle cx={0} cy={0} r={glowRadius} opacity={dayGlow}>
        <RadialGradient c={vec(0, 0)} r={glowRadius} colors={[...sola.glowDay]} />
      </Circle>
      <Circle cx={0} cy={0} r={glowRadius} opacity={night}>
        <RadialGradient c={vec(0, 0)} r={glowRadius} colors={[...sola.glowNight]} />
      </Circle>
      <Group transform={[{ scale }, { translateX: -sola.viewBox / 2 }, { translateY: -sola.viewBox / 2 }]}>
        <Path path="M100 30 C148 30 178 66 178 112 C178 156 146 180 100 180 C54 180 22 156 22 112 C22 66 52 30 100 30 Z">
          <RadialGradient c={vec(76, 60)} r={156} colors={[...sola.body]} positions={[...sola.bodyStops]} />
        </Path>
        <Path path="M101 32 C92 18 99 6 113 5 C117 18 112 28 101 32 Z" color={sola.body[2]} />
        <Oval x={45} y={116} width={26} height={16} color={sola.cheek} opacity={sola.cheekOpacity} />
        <Oval x={129} y={116} width={26} height={16} color={sola.cheek} opacity={sola.cheekOpacity} />
        <Group opacity={awake}>
          <Oval x={67} y={94} width={16} height={20} color={sola.ink} />
          <Oval x={117} y={94} width={16} height={20} color={sola.ink} />
          <Circle cx={78} cy={100} r={2.8} color={sola.body[0]} />
          <Circle cx={128} cy={100} r={2.8} color={sola.body[0]} />
        </Group>
        <Path
          path="M64 104 Q75 114 86 104 M114 104 Q125 114 136 104"
          style="stroke"
          strokeWidth={5}
          strokeCap="round"
          color={sola.ink}
          opacity={sleeping}
        />
        <Path path={mouth} style="stroke" strokeWidth={5} strokeCap="round" color={sola.ink} />
      </Group>
    </Group>
  );
}

export function SkyCanvas({ size, bands, minute, mood, clock, shootingStartedAt, owlStartedAt, moonPhaseValue, lite }: {
  size: Size;
  bands: SkyBands;
  minute: SharedValue<number>;
  mood: SharedValue<number>;
  clock: SharedValue<number>;
  shootingStartedAt: SharedValue<number>;
  owlStartedAt: SharedValue<number>;
  moonPhaseValue: number;
  lite: boolean;
}) {
  const colors = useDerivedValue(() => timeStops(minute.get()).map(rgbToCss));
  const night = useDerivedValue(() => nightAmount(minute.get()));
  const { scene } = bands;
  const cornerX = size.width - skyColor.cornerInsetX;
  const cornerY = bands.dateBottom - skyColor.cornerInsetY + skyColor.moonRadius;

  // Stars only sit where there is no text: beside Sola and in the top of the scene.
  const stars = useMemo(() => {
    const count = lite ? skyMotion.starCountLite : skyMotion.starCount;
    const { starMinPeriod, starMaxPeriod, starMinRadius, starMaxRadius } = skyMotion;
    const solaTop = bands.dateBottom;
    const solaBand = bands.solaSize;
    const sceneBand = scene.height * STAR_SCENE_SHARE;
    return Array.from({ length: count }, (_, i) => {
      const inScene = i % 3 !== 0;
      return {
        id: i,
        x: seeded(i + 1) * size.width,
        y: inScene ? scene.top + seeded(i + 41) * sceneBand : solaTop + seeded(i + 41) * solaBand,
        r: starMinRadius + seeded(i + 83) * (starMaxRadius - starMinRadius),
        period: starMinPeriod + seeded(i + 127) * (starMaxPeriod - starMinPeriod),
        phase: seeded(i + 173) * TWO_PI,
      };
    });
  }, [bands.dateBottom, bands.solaSize, lite, scene.height, scene.top, size.width]);

  const petalCount = lite ? petals.countLite : petals.count;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={size.width} height={size.height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, size.height)} colors={colors} positions={[...skyStopPositions]} />
      </Rect>

      {stars.map((s) => (
        <Star key={s.id} x={s.x} y={s.y} r={s.r} period={s.period} phase={s.phase} clock={clock} night={night} />
      ))}
      <Moon x={cornerX} y={cornerY} phase={moonPhaseValue} night={night} />
      <Sun x={cornerX} y={cornerY} night={night} />
      {cloudLayers.map((layer) => (
        <CloudLayer
          key={`${layer.band}-${layer.at}`}
          layer={layer}
          y={layer.band === 'sola' ? bands.solaCenterY : scene.top + scene.height * layer.at}
          width={size.width}
          clock={clock}
          minute={minute}
        />
      ))}
      <ShootingStar
        clock={clock}
        startedAt={shootingStartedAt}
        startX={size.width * 0.72}
        startY={scene.top + scene.height * 0.05}
        night={night}
      />

      <StaticScene rect={scene} night={night} />
      {sceneShapes.shimmer.map(([x, y, width], index) => (
        <Shimmer
          key={y}
          x={x * scene.width}
          y={scene.top + y * scene.height}
          width={width}
          index={index}
          clock={clock}
        />
      ))}
      {Array.from({ length: petalCount }, (_, index) => (
        <Petal key={index} index={index} rect={scene} clock={clock} night={night} />
      ))}
      <Owl rect={scene} clock={clock} startedAt={owlStartedAt} />

      <Sola cx={size.width / 2} cy={bands.solaCenterY} size={bands.solaSize} mood={mood} minute={minute} night={night} />
    </Canvas>
  );
}
