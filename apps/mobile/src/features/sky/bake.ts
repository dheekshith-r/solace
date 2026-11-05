// Draws the static scene once into images, one for day and one for night. Per frame, the app only
// draws these images, so all this detail costs almost nothing while animating.

import { BlurStyle, Skia, type SkCanvas, type SkImage, type SkPath } from '@shopify/react-native-skia';
import { blossom, sceneColor, sceneShapes, type Limb } from '../../theme/sky';
import { treeShape, type SceneRect } from './landscape';
import { landscapeEffect } from './landscapeShader';
import { hexToRgb, mixRgb, type Rgb } from './skyColors';

export type Light = 'day' | 'night';

const SCALE = 2; // Enough for soft, distant detail, and cheap on memory.
const hig = sceneColor.hig;

const mix = (a: string, b: string, t: number): Rgb => mixRgb(hexToRgb(a), hexToRgb(b), t);
const blend = (a: Rgb, b: string, t: number): Rgb => mixRgb(a, hexToRgb(b), t);
const unit = (c: Rgb) => [c[0] / 255, c[1] / 255, c[2] / 255];
const css = (c: Rgb) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

/** Every scene color is a mix of HIG tokens. Night pulls each one toward the night sky. */
function landscapeColors(light: Light) {
  const night = (c: Rgb, t: number) => (light === 'night' ? blend(c, hig.nightSky, t) : c);
  return {
    rockLit: night(blend(mix(hig.gray, hig.blue, 0.2), hig.white, 0.22), 0.72),
    rockShade: night(blend(mix(hig.grayDark, hig.blue, 0.22), hig.gray, 0.42), 0.72),
    snowLit: night(mix(hig.white, hig.white, 0), 0.5),
    snowShade: night(mix(hig.white, hig.blue, 0.2), 0.64),
    haze: night(mix(hig.gray6, hig.skyDay, 0.62), 0.84),
    lake: night(mix(hig.blue, hig.skyDay, 0.55), 0.72),
    grassFar: night(mix(hig.green, hig.skyDay, 0.28), 0.82),
    grassMid: night(mix(hig.green, hig.greenDeep, 0.3), 0.84),
    grassNear: night(mix(hig.greenDeep, hig.grayDark, 0.12), 0.84),
    bank: night(mix(hig.brownDeep, hig.grayDark, 0.15), 0.8),
  };
}

function bakeInto(width: number, height: number, draw: (canvas: SkCanvas) => void): SkImage | null {
  const w = Math.ceil(width * SCALE);
  const h = Math.ceil(height * SCALE);
  const surface = Skia.Surface.MakeOffscreen(w, h) ?? Skia.Surface.Make(w, h);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.scale(SCALE, SCALE);
  draw(canvas);
  surface.flush();
  const image = surface.makeImageSnapshot();
  return image.makeNonTextureImage();
}

export function bakeLandscape(rect: SceneRect, light: Light): SkImage | null {
  if (!landscapeEffect || rect.height <= 0) return null;
  const c = landscapeColors(light);
  const s = sceneShapes.stream;
  const uniforms = [
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
    light === 'day' ? 0.75 : -0.75,
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
  ];
  const shader = landscapeEffect.makeShader(uniforms);
  return bakeInto(rect.width, rect.height, (canvas) => {
    const paint = Skia.Paint();
    paint.setShader(shader);
    canvas.drawRect(Skia.XYWHRect(0, 0, rect.width, rect.height), paint);
  });
}

/** One tree: shaded wood with light on the side facing it, under soft clusters of blossom. */
export function bakeTree(
  limbs: readonly Limb[],
  rect: SceneRect,
  seedBase: number,
  regionX: number,
  regionWidth: number,
  light: Light,
): SkImage | null {
  if (rect.height <= 0) return null;
  const { outline, flowers } = treeShape(limbs, rect, seedBase);
  const wood = Skia.Path.MakeFromSVGString(outline) ?? Skia.Path.Make();
  const night = (c: Rgb, t: number) => css(light === 'night' ? blend(c, hig.nightSky, t) : c);
  const lightX = light === 'day' ? 1 : -1;

  const mass = Skia.PathBuilder.Make();
  const back = Skia.PathBuilder.Make();
  const middle = Skia.PathBuilder.Make();
  const front = Skia.PathBuilder.Make();
  const hearts = Skia.PathBuilder.Make();
  flowers.forEach(({ x, y, r }, index) => {
    mass.addCircle(x, y, r * blossom.massRadius);
    const layer = index % 3 === 0 ? back : index % 3 === 1 ? middle : front;
    for (let i = 0; i < 5; i += 1) {
      const angle = (Math.PI * 2 * i) / 5 + index * 1.3;
      layer.addCircle(x + Math.cos(angle) * r * blossom.petalOffset, y + Math.sin(angle) * r * blossom.petalOffset, r * blossom.petalRadius);
    }
    if (index % 3 === 2) hearts.addCircle(x, y, r * blossom.centerRadius);
  });

  return bakeInto(regionWidth, rect.height, (canvas) => {
    canvas.translate(-regionX, -rect.top);
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    const fill = (path: SkPath, color: string, opacity: number, blur = 0) => {
      paint.setMaskFilter(blur > 0 ? Skia.MaskFilter.MakeBlur(BlurStyle.Normal, blur, true) : null);
      paint.setColor(Skia.Color(color));
      paint.setAlphaf(opacity);
      canvas.drawPath(path, paint);
    };

    // Wood: dark, then a lit edge on the side facing the light, kept inside the limb.
    fill(wood, night(mix(hig.brownDeep, hig.grayDark, 0.45), 0.72), 1, 0.35);
    canvas.save();
    canvas.clipPath(wood, 1, true);
    canvas.translate(lightX * 1.1, -1.3);
    fill(wood, night(mix(hig.brown, hig.white, 0.12), 0.72), 0.85, 0.7);
    canvas.restore();

    // Blossom: a soft mass of color behind three layers of flowers, furthest softest and deepest.
    fill(mass.build(), night(mix(hig.pink, hig.white, 0.62), 0.6), 0.34, blossom.massBlur);
    fill(back.build(), night(mix(hig.pink, hig.white, 0.62), 0.58), 0.9, 0.9);
    fill(middle.build(), night(mix(hig.pink, hig.white, 0.76), 0.54), 0.95, 0.45);
    fill(front.build(), night(mix(hig.pink, hig.white, 0.88), 0.5), 1, 0.2);
    fill(hearts.build(), night(mix(hig.pink, hig.white, 0.25), 0.55), 0.7, 0.3);
  });
}
