import {
  BlurMask,
  BlurStyle,
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
  Shader,
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
  cloudNight,
  cloudShapes,
  fallingPetal,
  meadow,
  moon,
  starField,
  sceneColor,
  sceneShapes,
  skyColor,
  skyMotion,
  skyStopPositions,
  sola,
  treeDrop,
  trees,
  water,
  wind,
  type Limb,
} from '../../theme/sky';
import { today } from '../../theme/tokens';
import { sleepyAmount } from './astro';
import { gustSway, petalPose, scenePaths, treeShape, tuftBatch, type SceneRect } from './landscape';
import { hexToRgb, mixRgb, moonAmount, nightAmount, rgbToCss, sunAmount, timeStops, type Rgb } from './skyColors';
import { starEffect } from './starShader';
import { waterEffect } from './waterShader';

const TWO_PI = Math.PI * 2;
const CLOUD_MARGIN = 100;
const GROUND_SHARE = 0.86; // Just above the sheet's top edge.
const TUFT_BASE_BELOW_SHEET = 4; // Tufts grow from just behind the sheet's edge.

type Size = { width: number; height: number };

export type Gust = { start: number; count: number; seed: number };

// The parts of the screen with no text behind them.
export type SkyBands = {
  dateBottom: number;
  solaCenterY: number;
  solaSize: number;
  scene: SceneRect;
};

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
    cloudShapes[layer.shape]?.forEach(([x, py, r]) => {
      builder.addCircle(x * layer.scale, py * layer.scale, r * layer.scale);
    });
    return builder.build();
  }, [layer.scale, layer.shape]);

  const transform = useDerivedValue(() => {
    const x = ((clock.get() * layer.speed + span * layer.offset) % span) - CLOUD_MARGIN;
    return [{ translateX: x }, { translateY: y }];
  });
  // White by day. At night the body takes the sky's color and the moon lights one edge.
  const bodyColor = useDerivedValue(() =>
    rgbToCss(mixRgb(hexToRgb(skyColor.cloud), hexToRgb(cloudNight.body), nightAmount(minute.get()))),
  );
  const bodyOpacity = useDerivedValue(() => {
    const n = nightAmount(minute.get());
    return layer.opacity * (skyColor.cloudDayOpacity + (cloudNight.bodyOpacity - skyColor.cloudDayOpacity) * n);
  });
  const rimOpacity = useDerivedValue(() => moonAmount(minute.get()) * cloudNight.rimOpacity * layer.opacity);

  return (
    <Group transform={transform}>
      <Group transform={[{ translateX: cloudNight.rimOffsetX }, { translateY: cloudNight.rimOffsetY }]}>
        <Path path={path} color={skyColor.moon} opacity={rimOpacity}>
          <BlurMask blur={cloudNight.blur * 0.7} style="normal" />
        </Path>
      </Group>
      <Path path={path} color={bodyColor} opacity={bodyOpacity}>
        <BlurMask blur={cloudNight.blur} style="normal" />
      </Path>
    </Group>
  );
}

function StarField({ size, horizon, clock, night, lite }: {
  size: Size;
  horizon: number;
  clock: SharedValue<number>;
  night: SharedValue<number>;
  lite: boolean;
}) {
  const uniforms = useDerivedValue(() => ({
    time: clock.get(),
    night: night.get(),
    horizon,
    width: size.width,
    cell: lite ? starField.cellLite : starField.cell,
    milky: starField.milkyWay,
  }));
  if (!starEffect) return null;
  return (
    <Rect x={0} y={0} width={size.width} height={horizon}>
      <Shader source={starEffect} uniforms={uniforms} />
    </Rect>
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

function Moon({ x, y, minute }: { x: number; y: number; minute: SharedValue<number> }) {
  const r = moon.radius;
  const picture = useMemo(() => {
    const clip = Skia.PathBuilder.Make().addCircle(0, 0, r).build();
    const maria = Skia.PathBuilder.Make();
    moon.maria.forEach(([mx, my, rx, ry]) => {
      maria.addOval(Skia.XYWHRect((mx - rx) * r, (my - ry) * r, rx * 2 * r, ry * 2 * r));
    });
    const mariaPath = maria.build();
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setColor(Skia.Color(skyColor.moon));
      canvas.drawPath(clip, paint);
      canvas.save();
      canvas.clipPath(clip, 1, true);
      paint.setColor(Skia.Color(moon.mariaColor));
      paint.setAlphaf(moon.mariaOpacity);
      paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, moon.mariaBlur, true));
      canvas.drawPath(mariaPath, paint);
      paint.setMaskFilter(null);
      paint.setColor(Skia.Color(skyColor.cloud));
      paint.setAlphaf(0.9);
      canvas.drawCircle(moon.tycho.x * r, moon.tycho.y * r, moon.tycho.radius * r, paint);
      canvas.restore();
    });
  }, [r]);
  const opacity = useDerivedValue(() => moonAmount(minute.get()));
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]} opacity={opacity}>
      <Circle cx={0} cy={0} r={r * moon.haloRadius}>
        <RadialGradient c={vec(0, 0)} r={r * moon.haloRadius} colors={[...moon.halo]} positions={[...moon.haloStops]} />
      </Circle>
      <Picture picture={picture} />
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
    const ridges = toPath(paths.ridges);
    const streaks = toPath(paths.streaks);
    const slopeLines = toPath(paths.slopeLines);
    const ticks = toPath(paths.ticks);
    const pool = toPath(paths.pool);
    const hillFar = toPath(paths.hillFar);
    const hillNear = toPath(paths.hillNear);
    const bank = toPath(paths.bank);
    const hillFront = toPath(paths.hillFront);
    const grassDark = toPath(paths.grassDark);
    const grassLight = toPath(paths.grassLight);

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
        // Rock texture first, then the shaded side away from the sun.
        fill(slopeLines, sceneColor.rock, sceneColor.rockLineOpacity);
        fill(ticks, sceneColor.rock, sceneColor.rockTickOpacity);
        fill(snow, sceneColor.snow, 1);
        fill(streaks, sceneColor.snow, 0.9);
        fill(snowShadows, sceneColor.snowShadow, sceneColor.snowShadowOpacity);
        fill(ridges, sceneColor.ridgeShadow, sceneColor.ridgeShadowOpacity);
        const detail = sceneShapes.fujiDetail;
        paint.setAlphaf(1);
        paint.setShader(
          Skia.Shader.MakeLinearGradient(
            vec(0, 0),
            vec(rect.width * detail.shadeToX, 0),
            [Skia.Color(sceneColor.rock), Skia.Color('rgba(28,28,30,0)')],
            null,
            0,
          ),
        );
        paint.setAlphaf(sceneColor.shadeOpacity);
        canvas.drawPath(mountain, paint);
        // Haze thickens toward the base because the mountain is far away.
        paint.setAlphaf(sceneColor.hazeOpacity);
        paint.setShader(
          Skia.Shader.MakeLinearGradient(
            vec(0, rect.top + rect.height * detail.hazeFromY),
            vec(0, footY),
            [Skia.Color('rgba(242,242,247,0)'), Skia.Color(sceneColor.haze)],
            null,
            0,
          ),
        );
        canvas.drawPath(mountain, paint);
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
      fill(hillFront, meadow.near, meadow.frontOpacity);
      fill(grassDark, meadow.near, meadow.darkBladeOpacity);
      fill(grassLight, sceneColor.hill, meadow.lightBladeOpacity);
      // Soft banks under the water.
      paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sceneShapes.stream.bankBlur, true));
      fill(bank, sceneColor.bank, sceneColor.bankOpacity);
      paint.setMaskFilter(null);
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

/** One batch of grass tufts at the bottom edge, leaning with the breeze and gusts. */
function TuftBatch({ batch, width, baseY, night, clock, gust }: {
  batch: number;
  width: number;
  baseY: number;
  night: SharedValue<number>;
  clock: SharedValue<number>;
  gust: SharedValue<Gust>;
}) {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(tuftBatch(batch, width, baseY)) ?? Skia.Path.Make(), [batch, baseY, width]);
  const transform = useDerivedValue(() => {
    const t = clock.get();
    const breeze = Math.sin(t * meadow.swaySpeed + batch * 1.9) * meadow.swayAmount;
    const lean = breeze + (gustSway(t - gust.get().start) / wind.swayRadians) * meadow.gustAmount;
    return [{ translateY: baseY }, { skewX: lean }, { translateY: -baseY }];
  });
  const overlay = useDerivedValue(() => night.get() * sceneColor.nightOverlayOpacity);
  return (
    <Group transform={transform}>
      <Path path={path} color={meadow.near} />
      <Path path={path} color={sceneColor.nightOverlay} opacity={overlay} />
    </Group>
  );
}

/** The stream: one shader pass that reflects the sky, mountain and moon through flowing noise. */
function StreamWater({ rect, minute, clock }: { rect: SceneRect; minute: SharedValue<number>; clock: SharedValue<number> }) {
  const s = sceneShapes.stream;
  const top = rect.top + rect.height * s.topY;
  const bottom = rect.top + rect.height * s.bottomY;
  const uniforms = useDerivedValue(() => {
    const stops = timeStops(minute.get());
    const unit = (c: Rgb) => [c[0] / 255, c[1] / 255, c[2] / 255];
    const n = nightAmount(minute.get());
    return {
      time: clock.get(),
      width: rect.width,
      top,
      bottom,
      far: unit(stops[3] as Rgb),
      near: unit(stops[0] as Rgb),
      tint: unit(hexToRgb(water.tint)),
      mountain: unit(hexToRgb(sceneColor.mountain)).map((v) => v * (1 - n * sceneColor.nightOverlayOpacity)),
      moon: moonAmount(minute.get()),
      moonX: water.moonX,
      night: n,
      centerX: s.centerX,
      bendStart: s.bendStart,
      bendGrowth: s.bendGrowth,
      bends: s.bends,
      widthStart: s.widthStart,
      widthGrowth: s.widthGrowth,
      widthPower: s.widthPower,
      flow: water.flow,
    };
  });
  if (!waterEffect) return null;
  return (
    <Rect x={0} y={top} width={rect.width} height={bottom - top}>
      <Shader source={waterEffect} uniforms={uniforms} />
    </Rect>
  );
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
    // The wood's night overlay stops at the flowers, so branches don't cut across them.
    const bareWood = Skia.Path.MakeFromOp(woodPath, flowerPath, PathOp.Difference) ?? woodPath;
    return { picture: pic, wood: bareWood, flowerShape: flowerPath };
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
    return [
      { translateX: p.x },
      { translateY: p.y },
      { rotate: p.rotate },
      { scaleX: fallingPetal.scale * p.flutter },
      { scaleY: fallingPetal.scale },
    ];
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

function Sola({ cx, cy, size, mood, minute, night, clock }: {
  cx: number;
  cy: number;
  size: number;
  mood: SharedValue<number>;
  minute: SharedValue<number>;
  night: SharedValue<number>;
  clock: SharedValue<number>;
}) {
  const scale = size / sola.viewBox;
  const glowRadius = size * sola.glowRatio;
  const dayGlow = useDerivedValue(() => 1 - night.get());
  const sleeping = useDerivedValue(() => sleepyAmount(minute.get()));
  const awake = useDerivedValue(() => 1 - sleeping.get());
  const float = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy + Math.sin((TWO_PI * clock.get()) / sola.floatPeriod) * sola.floatDistance },
  ]);
  // Everything on the face follows the same mood value, so it all eases together.
  const eyes = useDerivedValue(() => [
    { translateY: sola.eyeY },
    { scaleY: sola.eyeLow + ((1 - sola.eyeLow) * (mood.get() - 1)) / 4 },
    { translateY: -sola.eyeY },
  ]);
  const blush = useDerivedValue(() => sola.blushLow + ((sola.blushHigh - sola.blushLow) * (mood.get() - 1)) / 4);
  const mouth = useDerivedValue(() => {
    const y = 132 + (mood.get() - 3) * sola.mouthCurve;
    return Skia.Path.MakeFromSVGString(`M86 130 Q100 ${y} 114 130`) ?? Skia.Path.Make();
  });

  return (
    <Group transform={float}>
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
        <Oval x={45} y={116} width={26} height={16} color={sola.cheek} opacity={blush} />
        <Oval x={129} y={116} width={26} height={16} color={sola.cheek} opacity={blush} />
        <Group opacity={awake} transform={eyes}>
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

export function SkyCanvas({ size, bands, minute, mood, clock, gust, shootingStartedAt, lite }: {
  size: Size;
  bands: SkyBands;
  minute: SharedValue<number>;
  mood: SharedValue<number>;
  clock: SharedValue<number>;
  gust: SharedValue<Gust>;
  shootingStartedAt: SharedValue<number>;
  lite: boolean;
}) {
  const colors = useDerivedValue(() => timeStops(minute.get()).map(rgbToCss));
  const night = useDerivedValue(() => nightAmount(minute.get()));
  const { scene } = bands;
  const bodyX = size.width * skyColor.bodyX;
  const bodyY = bands.solaCenterY + skyColor.bodyBelowSola;

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

      <StarField size={size} horizon={scene.top + scene.height * sceneShapes.fuji.footY} clock={clock} night={night} lite={lite} />
      <Moon x={bodyX} y={bodyY} minute={minute} />
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
      <StreamWater rect={scene} minute={minute} clock={clock} />
      {Array.from({ length: meadow.swayBatches }, (_, batch) => (
        <TuftBatch
          key={batch}
          batch={batch}
          width={size.width}
          baseY={scene.top + scene.height - today.sheetOverlap + TUFT_BASE_BELOW_SHEET}
          night={night}
          clock={clock}
          gust={gust}
        />
      ))}
      <Tree
        limbs={trees.left}
        seedBase={11}
        pivotX={0}
        pivotY={scene.top + scene.height * treeDrop}
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
        pivotY={scene.top + scene.height * treeDrop}
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
      <Sola cx={size.width / 2} cy={bands.solaCenterY} size={bands.solaSize} mood={mood} minute={minute} night={night} clock={clock} />
    </Canvas>
  );
}
