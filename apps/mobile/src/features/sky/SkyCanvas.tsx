import {
  BlurMask,
  BlurStyle,
  Canvas,
  Circle,
  createPicture,
  Group,
  Image as SkiaImage,
  Line,
  LinearGradient,
  Oval,
  Path,
  Picture,
  RadialGradient,
  Rect,
  Shader,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
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
import { moonProgress, skyArc, sleepyAmount, sunProgress } from './astro';
import { bakeLandscape, bakeTree } from './bake';
import { gustSway, petalPose, treeShape, tuftBatch, type SceneRect } from './landscape';
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

function Sun({ width, apexY, endY, minute }: { width: number; apexY: number; endY: number; minute: SharedValue<number> }) {
  const opacity = useDerivedValue(() => sunAmount(minute.get()));
  const transform = useDerivedValue(() => {
    const p = skyArc(sunProgress(minute.get()), width, apexY, endY, skyColor.arcEdgeOverscan);
    return [{ translateX: p.x }, { translateY: p.y }];
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={skyColor.sunRadius}>
        <RadialGradient c={vec(0, 0)} r={skyColor.sunRadius} colors={[...skyColor.sun]} positions={[...skyColor.sunStops]} />
      </Circle>
    </Group>
  );
}

function Moon({ width, apexY, endY, minute }: { width: number; apexY: number; endY: number; minute: SharedValue<number> }) {
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
  const transform = useDerivedValue(() => {
    const p = skyArc(moonProgress(minute.get()), width, apexY, endY, skyColor.arcEdgeOverscan);
    return [{ translateX: p.x }, { translateY: p.y }];
  });
  return (
    <Group transform={transform} opacity={opacity}>
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

/** The landscape: painted once into a day and a night image, cross-faded with the time of day. */
function StaticScene({ rect, night }: { rect: SceneRect; night: SharedValue<number> }) {
  const images = useMemo(() => ({ day: bakeLandscape(rect, 'day'), night: bakeLandscape(rect, 'night') }), [rect]);
  return (
    <>
      {images.day ? <SkiaImage image={images.day} x={0} y={rect.top} width={rect.width} height={rect.height} fit="fill" /> : null}
      {images.night ? <SkiaImage image={images.night} x={0} y={rect.top} width={rect.width} height={rect.height} fit="fill" opacity={night} /> : null}
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
      <Path path={path}>
        <LinearGradient start={vec(0, baseY)} end={vec(0, baseY - meadow.tuftMaxHeight)} colors={[meadow.near, meadow.tip]} />
      </Path>
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
      // The column of light follows the moon, within the part of the stream that can show it.
      moonX: Math.min(water.moonMaxX, Math.max(water.moonMinX, moonProgress(minute.get()))),
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

/** One overhanging tree: baked once for day and night. Only its sway animates. */
function Tree({ limbs, seedBase, regionX, regionWidth, pivotX, pivotY, rect, night, clock, gust, swaySign }: {
  limbs: readonly Limb[];
  seedBase: number;
  regionX: number;
  regionWidth: number;
  pivotX: number;
  pivotY: number;
  rect: SceneRect;
  night: SharedValue<number>;
  clock: SharedValue<number>;
  gust: SharedValue<Gust>;
  swaySign: number;
}) {
  const images = useMemo(
    () => ({
      day: bakeTree(limbs, rect, seedBase, regionX, regionWidth, 'day'),
      night: bakeTree(limbs, rect, seedBase, regionX, regionWidth, 'night'),
    }),
    [limbs, rect, regionWidth, regionX, seedBase],
  );
  const transform = useDerivedValue(() => [{ rotate: swaySign * gustSway(clock.get() - gust.get().start) }]);
  return (
    <Group transform={transform} origin={vec(pivotX, pivotY)}>
      {images.day ? <SkiaImage image={images.day} x={regionX} y={rect.top} width={regionWidth} height={rect.height} fit="fill" /> : null}
      {images.night ? <SkiaImage image={images.night} x={regionX} y={rect.top} width={regionWidth} height={rect.height} fit="fill" opacity={night} /> : null}
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
  const arcApexY = bands.dateBottom + skyColor.arcApexBelowDate;
  const arcEndY = bands.solaCenterY + bands.solaSize * skyColor.arcEndBelowSola;

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
      <Moon width={size.width} apexY={arcApexY} endY={arcEndY} minute={minute} />
      <Sun width={size.width} apexY={arcApexY} endY={arcEndY} minute={minute} />
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
        regionX={0}
        regionWidth={size.width / 2}
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
        regionX={size.width / 2}
        regionWidth={size.width / 2}
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
