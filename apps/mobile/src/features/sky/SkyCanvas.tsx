import {
  Canvas,
  Circle,
  Group,
  Image as SkiaImage,
  Line,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Rect,
  Shader,
  Skia,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { duration, easing } from '../../theme/motion';
import {
  cloudLayers,
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
  splash,
  treeDrop,
  trees,
  water,
  wind,
} from '../../theme/sky';
import { today } from '../../theme/tokens';
import { moonProgress, sideArc, sleepyAmount, sunProgress } from './astro';
import { gustSway, petalPose, treeShape, tuftBatch, type SceneRect } from './landscape';
import { goldenAmount, hexToRgb, moonAmount, nightAmount, rgbToCss, sunAmount, timeStops, type Rgb } from './skyColors';
import { starEffect } from './starShader';
import { useSceneImages, type SceneImages } from './useSceneImages';
import { splashEffect, waterEffect } from './waterShader';

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

function CloudLayer({ layer, index, images, y, width, clock, night }: {
  layer: (typeof cloudLayers)[number];
  index: number;
  images: SceneImages;
  y: number;
  width: number;
  clock: SharedValue<number>;
  night: SharedValue<number>;
}) {
  const span = width + layer.width + CLOUD_MARGIN;
  const dayImage = images[`cloud.${index}.day`];
  const nightImage = images[`cloud.${index}.night`];
  const dayOpacity = useDerivedValue(() => 1 - night.get());
  const transform = useDerivedValue(() => {
    const x = ((clock.get() * layer.speed + span * layer.offset) % span) - layer.width - CLOUD_MARGIN / 2;
    return [{ translateX: x }, { translateY: y }];
  });
  return (
    <Group transform={transform}>
      {dayImage ? <SkiaImage image={dayImage} x={0} y={0} width={layer.width} height={layer.height} fit="fill" opacity={dayOpacity} /> : null}
      {nightImage ? <SkiaImage image={nightImage} x={0} y={0} width={layer.width} height={layer.height} fit="fill" opacity={night} /> : null}
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
    const p = sideArc(sunProgress(minute.get()), width, apexY, endY, skyColor.sunEdgeX, skyColor.sunReachX);
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

function Moon({ image, width, apexY, endY, minute }: { image: SkImage | null | undefined; width: number; apexY: number; endY: number; minute: SharedValue<number> }) {
  const r = moon.radius;
  const opacity = useDerivedValue(() => moonAmount(minute.get()));
  const transform = useDerivedValue(() => {
    const p = sideArc(moonProgress(minute.get()), width, apexY, endY, skyColor.moonEdgeX, skyColor.moonReachX);
    return [{ translateX: p.x }, { translateY: p.y }];
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={r * moon.haloRadius}>
        <RadialGradient c={vec(0, 0)} r={r * moon.haloRadius} colors={[...moon.halo]} positions={[...moon.haloStops]} />
      </Circle>
      {image ? <SkiaImage image={image} x={-(r + 2)} y={-(r + 2)} width={(r + 2) * 2} height={(r + 2) * 2} fit="fill" /> : null}
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

/** The landscape: painted once for day, golden hour and night, cross-faded with the time of day. */
function StaticScene({ images, rect, night, minute }: { images: SceneImages; rect: SceneRect; night: SharedValue<number>; minute: SharedValue<number> }) {
  const dayImage = images['landscape.day'];
  const goldenImage = images['landscape.golden'];
  const nightImage = images['landscape.night'];
  const golden = useDerivedValue(() => goldenAmount(minute.get()));
  const place = { x: 0, y: rect.top, width: rect.width, height: rect.height, fit: 'fill' as const };
  return (
    <>
      {dayImage ? <SkiaImage image={dayImage} {...place} /> : null}
      {goldenImage ? <SkiaImage image={goldenImage} {...place} opacity={golden} /> : null}
      {nightImage ? <SkiaImage image={nightImage} {...place} opacity={night} /> : null}
    </>
  );
}

/** Ripples and a little foam where the stream runs into the lake. */
function StreamMouth({ rect, clock, night }: { rect: SceneRect; clock: SharedValue<number>; night: SharedValue<number> }) {
  const s = sceneShapes.stream;
  const centerX = rect.width * s.centerX;
  const centerY = rect.top + rect.height * s.topY;
  const halfW = (rect.width * splash.width) / 2;
  const halfH = splash.height / 2;
  const uniforms = useDerivedValue(() => {
    const n = night.get();
    return { time: clock.get(), center: [centerX, centerY], extent: [halfW, halfH], light: [1, 1, 1], opacity: splash.opacity * (1 - n * 0.55) };
  });
  if (!splashEffect) return null;
  return (
    <Rect x={centerX - halfW} y={centerY - halfH} width={halfW * 2} height={halfH * 2}>
      <Shader source={splashEffect} uniforms={uniforms} />
    </Rect>
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
      moonX: water.moonMinX,
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
function Tree({ dayImage, nightImage, regionX, regionWidth, pivotX, pivotY, rect, night, clock, gust, swaySign }: {
  dayImage: SkImage | null | undefined;
  nightImage: SkImage | null | undefined;
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
  const transform = useDerivedValue(() => [{ rotate: swaySign * gustSway(clock.get() - gust.get().start) }]);
  return (
    <Group transform={transform} origin={vec(pivotX, pivotY)}>
      {dayImage ? <SkiaImage image={dayImage} x={regionX} y={rect.top} width={regionWidth} height={rect.height} fit="fill" /> : null}
      {nightImage ? <SkiaImage image={nightImage} x={regionX} y={rect.top} width={regionWidth} height={rect.height} fit="fill" opacity={night} /> : null}
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

export function SkyCanvas({ size, bands, sceneReady, startsAtNight, minute, mood, clock, gust, shootingStartedAt, lite }: {
  size: Size;
  bands: SkyBands;
  sceneReady: boolean;
  startsAtNight: boolean;
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
  const images = useSceneImages(scene, size.width, sceneReady, startsAtNight);
  const hasScene = Boolean(images[startsAtNight ? 'landscape.night' : 'landscape.day']);
  const sceneOpacity = useSharedValue(0);
  useEffect(() => {
    if (hasScene) sceneOpacity.set(withTiming(1, { duration: duration.entrance, easing }));
  }, [hasScene, sceneOpacity]);
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
      <Moon image={images.moon} width={size.width} apexY={arcApexY} endY={arcEndY} minute={minute} />
      <Sun width={size.width} apexY={arcApexY} endY={arcEndY} minute={minute} />
      <Group opacity={sceneOpacity}>
      {cloudLayers.map((layer, index) => (
        <CloudLayer key={layer.seed} layer={layer} index={index} images={images} y={scene.top + scene.height * layer.at} width={size.width} clock={clock} night={night} />
      ))}
      <ShootingStar
        clock={clock}
        startedAt={shootingStartedAt}
        startX={size.width * 0.72}
        startY={scene.top + scene.height * 0.05}
        night={night}
      />

      <StaticScene images={images} rect={scene} night={night} minute={minute} />
      <StreamWater rect={scene} minute={minute} clock={clock} />
      <StreamMouth rect={scene} clock={clock} night={night} />
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
        dayImage={images['tree.left.day']}
        nightImage={images['tree.left.night']}
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
        dayImage={images['tree.right.day']}
        nightImage={images['tree.right.night']}
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
      </Group>
      <Sola cx={size.width / 2} cy={bands.solaCenterY} size={bands.solaSize} mood={mood} minute={minute} night={night} clock={clock} />
    </Canvas>
  );
}
