// Draws the static scene once into images. Per frame, the app only draws these images, so all this
// detail costs almost nothing while animating.

import { Skia, type SkCanvas, type SkImage, type SkPath } from '@shopify/react-native-skia';
import { cloudLayers, moon, sceneColor, sceneShapes, type Limb } from '../../theme/sky';
import { petalOutline, treeShape, type SceneRect } from './landscape';
import { landscapeEffect } from './landscapeShader';
import { barkEffect, cloudEffect, moonEffect } from './paintShaders';
import { hexToRgb, mixRgb, type Rgb } from './skyColors';

export type Light = 'day' | 'golden' | 'night';

const LANDSCAPE_SCALE = 2; // Soft, distant detail.
const NEAR_SCALE = 3; // Trees are close, and their petals must stay crisp.
const hig = sceneColor.hig;

const mix = (a: string, b: string, t: number): Rgb => mixRgb(hexToRgb(a), hexToRgb(b), t);
const unit = (c: Rgb) => [c[0] / 255, c[1] / 255, c[2] / 255];
const css = (c: Rgb) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

/** Every scene color is a mix of HIG tokens. Night and golden hour shift them toward their light. */
function shift(light: Light, c: Rgb, nightAmount: number, goldenAmount = 0.14): Rgb {
  if (light === 'night') return mixRgb(c, hexToRgb(hig.nightSky), nightAmount);
  if (light === 'golden') return mixRgb(c, hexToRgb(hig.orange), goldenAmount);
  return c;
}

function landscapeColors(light: Light) {
  const s = (c: Rgb, n: number, g?: number) => shift(light, c, n, g);
  return {
    rockLit: s(mixRgb(mix(hig.gray, hig.blue, 0.2), hexToRgb(hig.white), 0.22), 0.72),
    rockShade: s(mixRgb(mix(hig.grayDark, hig.blue, 0.22), hexToRgb(hig.gray), 0.42), 0.72, 0.16),
    snowLit: s(hexToRgb(hig.white), 0.5, 0.18),
    snowShade: s(mix(hig.white, hig.blue, 0.2), 0.64, 0.12),
    haze: s(mix(hig.gray6, hig.skyDay, 0.62), 0.84, 0.2),
    lake: s(mix(hig.blue, hig.skyDay, 0.55), 0.72, 0.16),
    grassFar: s(mix(hig.green, hig.skyDay, 0.28), 0.82),
    grassMid: s(mix(hig.green, hig.greenDeep, 0.3), 0.84),
    grassNear: s(mix(hig.greenDeep, hig.grayDark, 0.12), 0.84, 0.18),
    bank: s(mix(hig.brownDeep, hig.grayDark, 0.15), 0.8, 0.14),
  };
}

function bakeInto(width: number, height: number, scale: number, draw: (canvas: SkCanvas) => void): SkImage | null {
  const w = Math.ceil(width * scale);
  const h = Math.ceil(height * scale);
  const surface = Skia.Surface.MakeOffscreen(w, h) ?? Skia.Surface.Make(w, h);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);
  draw(canvas);
  surface.flush();
  return surface.makeImageSnapshot().makeNonTextureImage();
}

export function bakeLandscape(rect: SceneRect, light: Light): SkImage | null {
  if (!landscapeEffect || rect.height <= 0) return null;
  const c = landscapeColors(light);
  const s = sceneShapes.stream;
  const shader = landscapeEffect.makeShader([
    rect.width,
    rect.height,
    ...unit(c.rockLit),
    ...unit(c.rockShade),
    ...unit(c.snowLit),
    ...unit(c.snowShade),
    ...unit(c.haze),
    ...unit(c.lake),
    ...unit(c.grassFar),
    ...unit(c.grassMid),
    ...unit(c.grassNear),
    ...unit(c.bank),
    light === 'night' ? -0.75 : 0.75,
    sceneShapes.fuji.summitY,
    sceneShapes.fuji.footY,
    s.centerX,
    s.bendStart,
    s.bendGrowth,
    s.bends,
    s.widthStart,
    s.widthGrowth,
    s.widthPower,
    s.topY,
    s.bottomY,
  ]);
  return bakeInto(rect.width, rect.height, LANDSCAPE_SCALE, (canvas) => {
    const paint = Skia.Paint();
    paint.setShader(shader);
    canvas.drawRect(Skia.XYWHRect(0, 0, rect.width, rect.height), paint);
  });
}

export function bakeCloud(layer: (typeof cloudLayers)[number], light: Light): SkImage | null {
  if (!cloudEffect) return null;
  const n = light === 'night';
  const top = n ? mix(hig.gray, hig.nightSky, 0.5) : hexToRgb(hig.white);
  const under = n ? mix(hig.grayDark, hig.nightSky, 0.72) : mix(hig.white, hig.gray, 0.3);
  const shader = cloudEffect.makeShader([
    layer.width,
    layer.height,
    layer.seed,
    ...unit(top),
    ...unit(under),
    ...unit(hexToRgb(hig.gray6)),
    layer.opacity * (n ? 0.5 : 0.92),
    n ? 0.55 : 0,
  ]);
  return bakeInto(layer.width, layer.height, LANDSCAPE_SCALE, (canvas) => {
    const paint = Skia.Paint();
    paint.setShader(shader);
    canvas.drawRect(Skia.XYWHRect(0, 0, layer.width, layer.height), paint);
  });
}

export function bakeMoon(): SkImage | null {
  if (!moonEffect) return null;
  const size = (moon.radius + 2) * 2;
  const shader = moonEffect.makeShader([
    moon.radius,
    ...unit(hexToRgb(hig.gray6)),
    ...unit(hexToRgb(hig.gray)),
  ]);
  return bakeInto(size, size, NEAR_SCALE, (canvas) => {
    const paint = Skia.Paint();
    paint.setShader(shader);
    canvas.drawRect(Skia.XYWHRect(0, 0, size, size), paint);
  });
}

/** One tree: textured bark with knots and moss, under dense clusters of individual sakura petals. */
export function bakeTree(
  limbs: readonly Limb[],
  rect: SceneRect,
  seedBase: number,
  regionX: number,
  regionWidth: number,
  light: Light,
): SkImage | null {
  if (rect.height <= 0) return null;
  const { outline, flowers, knots, joints } = treeShape(limbs, rect, seedBase);
  const wood = Skia.Path.MakeFromSVGString(outline) ?? Skia.Path.Make();
  const night = (c: Rgb, t: number) => css(light === 'night' ? mixRgb(c, hexToRgb(hig.nightSky), t) : c);
  const nightUnit = (c: Rgb, t: number) => unit(light === 'night' ? mixRgb(c, hexToRgb(hig.nightSky), t) : c);
  const lightX = light === 'day' ? 1 : -1;

  const layers = [Skia.PathBuilder.Make(), Skia.PathBuilder.Make(), Skia.PathBuilder.Make()];
  const hearts = Skia.PathBuilder.Make();
  flowers.forEach((f) => {
    const builder = layers[f.layer];
    if (!builder) return;
    for (let i = 0; i < 5; i += 1) {
      const p = petalOutline(f.x, f.y, f.angle + (Math.PI * 2 * i) / 5, f.r);
      builder.moveTo(p.base.x, p.base.y);
      builder.cubicTo(p.c1.x, p.c1.y, p.c2.x, p.c2.y, p.tipLeft.x, p.tipLeft.y);
      builder.lineTo(p.notch.x, p.notch.y);
      builder.lineTo(p.tipRight.x, p.tipRight.y);
      builder.cubicTo(p.c3.x, p.c3.y, p.c4.x, p.c4.y, p.base.x, p.base.y);
      builder.close();
    }
    if (f.layer > 0) hearts.addCircle(f.x, f.y, f.r * 0.11);
  });

  return bakeInto(regionWidth, rect.height, NEAR_SCALE, (canvas) => {
    canvas.translate(-regionX, -rect.top);
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    const fill = (path: SkPath, color: string, opacity: number) => {
      paint.setShader(null);
      paint.setColor(Skia.Color(color));
      paint.setAlphaf(opacity);
      canvas.drawPath(path, paint);
    };

    // Bark, clipped to the wood, lit along the side facing the light.
    if (barkEffect) {
      paint.setAlphaf(1);
      paint.setShader(
        barkEffect.makeShader([
          ...nightUnit(mix(hig.brownDeep, hig.grayDark, 0.62), 0.74),
          ...nightUnit(mix(hig.brown, hig.brownDeep, 0.3), 0.74),
        ]),
      );
      canvas.drawPath(wood, paint);
    }
    canvas.save();
    canvas.clipPath(wood, 1, true);
    canvas.translate(lightX * 1.1, -1.5);
    fill(wood, night(mix(hig.brown, hig.white, 0.2), 0.74), 0.34);
    canvas.restore();
    canvas.save();
    canvas.clipPath(wood, 1, true);
    knots.forEach((k) => {
      const oval = Skia.XYWHRect(k.x - k.r * 1.5, k.y - k.r, k.r * 3, k.r * 2);
      const ring = Skia.PathBuilder.Make().addOval(oval).build();
      fill(ring, night(mix(hig.brownDeep, hig.grayDark, 0.85), 0.74), 0.8);
    });
    joints.forEach((j) => {
      fill(Skia.PathBuilder.Make().addCircle(j.x, j.y, j.r).build(), night(mix(hig.greenDeep, hig.grayDark, 0.4), 0.78), 0.28);
    });
    canvas.restore();

    // Flowers, inner and darker first. Outer flowers sit on top, with each petal distinct.
    const petalColors = [
      [night(mix(hig.pink, hig.white, 0.5), 0.6), 1],
      [night(mix(hig.pink, hig.white, 0.72), 0.56), 1],
      [night(mix(hig.pink, hig.white, 0.88), 0.52), 1],
    ] as const;
    layers.forEach((builder, index) => {
      const path = builder.build();
      canvas.save();
      canvas.translate(0.25, 0.45);
      fill(path, night(mix(hig.pink, hig.grayDark, 0.25), 0.66), 0.22);
      canvas.restore();
      const [color, opacity] = petalColors[index] ?? petalColors[0];
      fill(path, color, opacity);
    });
    fill(hearts.build(), night(mix(hig.pink, hig.white, 0.3), 0.6), 0.75);
  });
}
