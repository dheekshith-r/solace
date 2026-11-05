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
  type SkPath,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  blossom,
  cloudLayers,
  cloudPuffs,
  fallingPetal,
  sceneColor,
  sceneShapes,
  skyColor,
  skyMotion,
  skyStopPositions,
  sola,
  streamShimmer,
  trees,
  wind,
  type Limb,
} from '../../theme/sky';
import { isSleepy, moonLitPath } from './astro';
import { gustSway, petalPose, scenePaths, shimmerPose, treeShape, type SceneRect } from './landscape';
import { moonAmount, nightAmount, rgbToCss, sunAmount, timeStops } from './skyColors';

const TWO_PI = Math.PI * 2;
const CLOUD_MARGIN = 100;
const STAR_SCENE_SHARE = 0.34;
const GROUND_SHARE = 0.86; // Just above the sheet's top edge.

type Size = { width: number; height: number };

export type Gust = { start: number; count: number; seed: number };

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

function Sun({ x, y, minute }: { x: number; y: number; minute: SharedValue<number> }) {
  const opacity = useDerivedValue(() => sunAmount(minute.get()));
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]} opacity={opacity}>
      <Circle cx={0} cy={0} r={skyColor.sunRadius}>
        <RadialGradient c={vec(0, 0)} r={skyColor.sunRadius} colors={[...skyColor.sun]} positions={[0.32, 0.42, 1]} />
      </Circle>
    </Group>
  );
}

function Moon({ x, y, phase, minute }: { x: number; y: number; phase: number; minute: SharedValue<number> }) {
  const lit = useMemo(() => Skia.Path.MakeFromSVGString(moonLitPath(phase, skyColor.moonRadius)), [phase]);
  const opacity = useDerivedValue(() => moonAmount(minute.get()));
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]} opacity={opacity}>
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
  const { picture, silhouette, moonlitSnow } = useMemo(() => {
    const paths = scenePaths(rect);
    const toPath = (d: string) => Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();
    const mountain = toPath(paths.mountain);
    const snow = toPath(paths.snow);
    const snowShadows = toPath(paths.snowShadows);
    const pool = toPath(paths.pool);
    const hillFar = toPath(paths.hillFar);
    const hillNear = toPath(paths.hillNear);
    const stream = toPath(paths.stream);

    const pic = createPicture((canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      const fill = (path: ReturnType<typeof toPath>, color: string, opacity: number) => {
        paint.setShader(null);
        paint.setColor(Skia.Color(color));
        paint.setAlphaf(opacity);
        canvas.drawPath(path, paint);
      };

      // Fuji: gray fading into haze at its foot, with a blue veil because it is far away.
      const fuji = sceneShapes.fuji;
      const summitY = rect.top + rect.height * fuji.summitY;
      const footY = rect.top + rect.height * fuji.footY;
      const fujiGradient = (top: string, bottom: string) =>
        Skia.Shader.MakeLinearGradient(vec(0, summitY), vec(0, footY), [Skia.Color(top), Skia.Color(bottom)], null, 0);
      const drawFuji = () => {
        paint.setAlphaf(1);
        paint.setShader(fujiGradient(sceneColor.mountain, sceneColor.mountainFade));
        canvas.drawPath(mountain, paint);
        paint.setShader(fujiGradient(sceneColor.mountainBlue, sceneColor.mountainBlueFade));
        canvas.drawPath(mountain, paint);
        canvas.save();
        canvas.clipPath(mountain, 1, true);
        fill(snow, sceneColor.snow, 1);
        fill(snowShadows, sceneColor.snowShadow, sceneColor.snowShadowOpacity);
        canvas.restore();
      };
      drawFuji();
      fill(hillFar, sceneColor.hill, sceneColor.hillFarOpacity);

      // The still water at Fuji's foot holds a soft, squashed reflection.
      fill(pool, sceneColor.pool, sceneColor.poolOpacity);
      const waterLine = rect.top + rect.height * sceneShapes.pool.topY;
      canvas.save();
      canvas.clipPath(pool, 1, true);
      canvas.translate(0, waterLine);
      canvas.scale(1, -sceneShapes.pool.reflectionScale);
      canvas.translate(0, -footY);
      fill(mountain, sceneColor.mountain, sceneColor.reflectionOpacity);
      canvas.clipPath(mountain, 1, true);
      fill(snow, sceneColor.snow, sceneColor.reflectionOpacity);
      canvas.restore();

      fill(hillNear, sceneColor.hill, sceneColor.hillNearOpacity);
      fill(stream, sceneColor.stream, sceneColor.streamOpacity);
    });

    const union = [hillFar, hillNear].reduce(
      (all, next) => Skia.Path.MakeFromOp(all, next, PathOp.Union) ?? all,
      mountain,
    );
    // Snow clipped to the mountain, for the moonlit layer above the night overlay.
    const moonlitSnow = Skia.Path.MakeFromOp(snow, mountain, PathOp.Intersect) ?? snow;
    return { picture: pic, silhouette: union, moonlitSnow };
  }, [rect]);

  const overlay = useDerivedValue(() => night.get() * sceneColor.nightOverlayOpacity);
  const moonlight = useDerivedValue(() => night.get() * sceneColor.snowNightOpacity);

  return (
    <>
      <Picture picture={picture} />
      <Path path={silhouette} color={sceneColor.nightOverlay} opacity={overlay} />
      <Path path={moonlitSnow} color={sceneColor.snow} opacity={moonlight} />
    </>
  );
}

function Shimmer({ index, rect, clock }: { index: number; rect: SceneRect; clock: SharedValue<number> }) {
  const pose = useDerivedValue(() => shimmerPose(clock.get(), index));
  const p1 = useDerivedValue(() => {
    const g = pose.get();
    return vec((g.x - g.length / 2) * rect.width, rect.top + g.y * rect.height);
  });
  const p2 = useDerivedValue(() => {
    const g = pose.get();
    return vec((g.x + g.length / 2) * rect.width, rect.top + g.y * rect.height);
  });
  const opacity = useDerivedValue(() => pose.get().opacity);
  return <Line p1={p1} p2={p2} color={sceneColor.shimmer} strokeWidth={1.2} strokeCap="round" opacity={opacity} />;
}

/** One overhanging tree: cached once, with one overlay for night. Only its sway animates. */
function Tree({ limbs, seedBase, pivotX, pivotY, rect, night, clock, gust, swaySign }: {
  limbs: readonly Limb[];
  seedBase: number;
  pivotX: number;
  pivotY: number;
  rect: SceneRect;
  night: SharedValue<number>;
  clock: SharedValue<number>;
  gust: SharedValue<Gust>;
  swaySign: number;
}) {
  const { picture, wood, flowerShape } = useMemo(() => {
    const { outline, flowers } = treeShape(limbs, rect, seedBase);
    const woodPath = Skia.Path.MakeFromSVGString(outline) ?? Skia.Path.Make();
    // Every flower in one path, so the whole tree is only four draws.
    const petalsBuilder = Skia.PathBuilder.Make();
    const centersBuilder = Skia.PathBuilder.Make();
    flowers.forEach(({ x, y, r }) => {
      for (let i = 0; i < 5; i += 1) {
        const angle = (TWO_PI * i) / 5 + x;
        petalsBuilder.addCircle(
          x + Math.cos(angle) * r * blossom.petalOffset,
          y + Math.sin(angle) * r * blossom.petalOffset,
          r * blossom.petalRadius,
        );
      }
      centersBuilder.addCircle(x, y, r * blossom.centerRadius);
    });
    const flowerPath = petalsBuilder.build();
    const centerPath = centersBuilder.build();

    const pic = createPicture((canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      const fill = (path: SkPath, color: string, opacity: number) => {
        paint.setColor(Skia.Color(color));
        paint.setAlphaf(opacity);
        canvas.drawPath(path, paint);
      };
      fill(woodPath, sceneColor.branch, 1);
      fill(flowerPath, sceneColor.flowerBase, sceneColor.flowerBaseOpacity);
      fill(flowerPath, sceneColor.flowerVeil, sceneColor.flowerVeilOpacity);
      fill(centerPath, sceneColor.flowerVeil, sceneColor.flowerCenterOpacity);
    });
    return { picture: pic, wood: woodPath, flowerShape: flowerPath };
  }, [limbs, rect, seedBase]);

  const transform = useDerivedValue(() => [{ rotate: swaySign * gustSway(clock.get() - gust.get().start) }]);
  const woodOverlay = useDerivedValue(() => night.get() * sceneColor.nightOverlayOpacity);
  const flowerOverlay = useDerivedValue(() => night.get() * sceneColor.flowerNightOverlayOpacity);

  return (
    <Group transform={transform} origin={vec(pivotX, pivotY)}>
      <Picture picture={picture} />
      <Path path={wood} color={sceneColor.nightOverlay} opacity={woodOverlay} />
      <Path path={flowerShape} color={sceneColor.nightOverlay} opacity={flowerOverlay} />
    </Group>
  );
}

/** A petal slot. It stays invisible until a gust releases it from a blossom. */
function Petal({ index, origins, groundY, clock, gust, night }: {
  index: number;
  origins: readonly { x: number; y: number }[];
  groundY: number;
  clock: SharedValue<number>;
  gust: SharedValue<Gust>;
  night: SharedValue<number>;
}) {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(fallingPetal.shape) ?? Skia.Path.Make(), []);
  const count = origins.length;
  const pose = useDerivedValue(() => {
    const g = gust.get();
    if (index >= g.count) return petalPose(-1, 0, 0, groundY, 0);
    const pick = Math.abs(Math.floor(g.seed * 997 + index * 131)) % count;
    const origin = origins[pick] ?? { x: 0, y: 0 };
    // A small stagger, so the petals of one gust don't let go together.
    return petalPose(clock.get() - g.start - index * 0.45, origin.x, origin.y, groundY, g.seed * 6 + index * 1.9);
  });
  const transform = useDerivedValue(() => {
    const p = pose.get();
    return [{ translateX: p.x }, { translateY: p.y }, { rotate: p.rotate }, { scale: fallingPetal.scale }];
  });
  const opacity = useDerivedValue(() => {
    const n = night.get();
    return pose.get().opacity * (sceneColor.petalOpacity + (sceneColor.petalNightOpacity - sceneColor.petalOpacity) * n);
  });
  const veilOpacity = useDerivedValue(() => opacity.get() * sceneColor.petalVeilOpacity);
  return (
    <Group transform={transform}>
      <Path path={path} color={sceneColor.petalBase} opacity={opacity} />
      <Path path={path} color={sceneColor.petalVeil} opacity={veilOpacity} />
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

export function SkyCanvas({ size, bands, minute, mood, clock, gust, shootingStartedAt, moonPhaseValue, lite }: {
  size: Size;
  bands: SkyBands;
  minute: SharedValue<number>;
  mood: SharedValue<number>;
  clock: SharedValue<number>;
  gust: SharedValue<Gust>;
  shootingStartedAt: SharedValue<number>;
  moonPhaseValue: number;
  lite: boolean;
}) {
  const colors = useDerivedValue(() => timeStops(minute.get()).map(rgbToCss));
  const night = useDerivedValue(() => nightAmount(minute.get()));
  const { scene } = bands;
  const bodyX = size.width * skyColor.bodyX;
  const bodyY = bands.solaCenterY + skyColor.bodyBelowSola;

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

  // Petals only ever start from real blossoms on the two trees.
  const petalOrigins = useMemo(
    () => [...treeShape(trees.left, scene, 11).flowers, ...treeShape(trees.right, scene, 503).flowers].map(({ x, y }) => ({ x, y })),
    [scene],
  );

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={size.width} height={size.height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, size.height)} colors={colors} positions={[...skyStopPositions]} />
      </Rect>

      {stars.map((s) => (
        <Star key={s.id} x={s.x} y={s.y} r={s.r} period={s.period} phase={s.phase} clock={clock} night={night} />
      ))}
      <Moon x={bodyX} y={bodyY} phase={moonPhaseValue} minute={minute} />
      <Sun x={bodyX} y={bodyY} minute={minute} />
      {cloudLayers.map((layer) => (
        <CloudLayer
          key={layer.at}
          layer={layer}
          y={scene.top + scene.height * layer.at}
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
      {Array.from({ length: streamShimmer.count }, (_, index) => (
        <Shimmer key={index} index={index} rect={scene} clock={clock} />
      ))}
      <Tree
        limbs={trees.left}
        seedBase={11}
        pivotX={0}
        pivotY={scene.top}
        rect={scene}
        night={night}
        clock={clock}
        gust={gust}
        swaySign={1}
      />
      <Tree
        limbs={trees.right}
        seedBase={503}
        pivotX={size.width}
        pivotY={scene.top}
        rect={scene}
        night={night}
        clock={clock}
        gust={gust}
        swaySign={-1}
      />
      {Array.from({ length: wind.maxPetals }, (_, index) => (
        <Petal
          key={index}
          index={index}
          origins={petalOrigins}
          groundY={scene.top + scene.height * GROUND_SHARE}
          clock={clock}
          gust={gust}
          night={night}
        />
      ))}
      <Sola cx={size.width / 2} cy={bands.solaCenterY} size={bands.solaSize} mood={mood} minute={minute} night={night} />
    </Canvas>
  );
}
