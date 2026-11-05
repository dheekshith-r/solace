import { Skia } from '@shopify/react-native-skia';

// The whole star field in one GPU pass: many faint stars, few bright ones, denser toward the top,
// fading near the horizon, with a very faint Milky Way. Every star twinkles at its own pace.
const source = `
uniform float time;
uniform float night;
uniform float horizon;
uniform float width;
uniform float cell;
uniform float milky;

float rand(float2 p) {
  return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rand(i), rand(i + float2(1.0, 0.0)), f.x),
             mix(rand(i + float2(0.0, 1.0)), rand(i + float2(1.0, 1.0)), f.x), f.y);
}

half4 main(float2 p) {
  if (night <= 0.01) return half4(0.0);
  float depth = clamp(p.y / horizon, 0.0, 1.0);
  float fade = 1.0 - smoothstep(0.62, 1.0, depth);

  // A diagonal band with a soft, uneven edge.
  float across = (p.x / width - 0.72 + depth * 0.5) / 0.2;
  float texture = 0.55 * noise(p * 0.018) + 0.3 * noise(p * 0.043) + 0.15 * noise(p * 0.11);
  float band = exp(-across * across) * smoothstep(0.25, 0.75, texture);

  // Denser toward the top, and inside the band.
  float2 id = floor(p / cell);
  float exists = rand(id + 3.1);
  float chance = mix(0.62, 0.16, depth) + band * 0.3;
  float star = 0.0;
  if (exists < chance) {
    float2 centre = (id + 0.18 + 0.64 * float2(rand(id + 7.7), rand(id + 13.3))) * cell;
    float size = rand(id + 19.9);
    float bright = size * size * size * size * size * size;
    float radius = mix(0.5, 1.5, bright);
    float glow = 1.0 - smoothstep(radius * 0.3, radius, length(p - centre));
    float pace = mix(0.35, 1.5, rand(id + 29.3));
    float twinkle = 0.62 + 0.38 * sin(time * pace + rand(id + 37.1) * 6.283);
    star = glow * mix(0.26, 1.0, bright) * twinkle;
  }

  float light = (star + band * milky) * fade * night;
  return half4(light);
}
`;

export const starEffect = Skia.RuntimeEffect.Make(source);
