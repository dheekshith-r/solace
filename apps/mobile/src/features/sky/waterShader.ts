import { Skia } from '@shopify/react-native-skia';

// The stream, drawn entirely by this shader: no shapes on top of it. Flowing noise distorts the
// reflections of the sky, mountain and moon, and everything moves away from the viewer. The banks
// are a soft fade computed from the same curve as streamAt in landscape.ts.
const source = `
uniform float time;
uniform float width;
uniform float top;
uniform float bottom;
uniform float3 far;
uniform float3 near;
uniform float3 tint;
uniform float3 mountain;
uniform float moon;
uniform float moonX;
uniform float night;
uniform float centerX;
uniform float bendStart;
uniform float bendGrowth;
uniform float bends;
uniform float widthStart;
uniform float widthGrowth;
uniform float widthPower;
uniform float flow;

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
  float d = clamp((p.y - top) / (bottom - top), 0.0, 1.0);
  float x = p.x / width;
  float center = centerX - (bendStart + bendGrowth * d) * sin(6.2831853 * bends * d);
  float halfWidth = (widthStart + widthGrowth * pow(d, widthPower)) * 0.5;
  float edge = abs(x - center) / halfWidth;
  float alpha = 1.0 - smoothstep(0.72, 1.0, edge);
  if (alpha <= 0.0) return half4(0.0);

  // Perspective: ripples are small and tight in the distance, broad up close. Subtracting time
  // from this coordinate moves every feature toward the mountain.
  float depth = 1.0 / (d + 0.14);
  float2 q = float2((x - center) * depth * 9.0, depth * 2.4 - time * flow);
  float wobble = 0.6 * noise(q) + 0.3 * noise(q * 2.1 + 7.3) + 0.1 * noise(q * 4.3 + 3.1) - 0.5;

  // The far water reflects the low sky and the mountain, the near water the sky overhead.
  float3 color = mix(far, near, clamp(d + wobble * 0.3, 0.0, 1.0));
  color = mix(color, tint, 0.16);
  float mountainShare = 1.0 - smoothstep(0.0, 0.42, d + wobble * 0.12);
  color = mix(color, mountain, mountainShare * 0.42);

  // The moon's broken column of light.
  float columnWidth = 0.035 + 0.06 * d;
  float across = (x - moonX + wobble * 0.09) / columnWidth;
  float column = exp(-across * across) * smoothstep(0.08, 0.55, d);
  color += moon * column * (0.34 + 0.9 * max(wobble + 0.12, 0.0));

  // Soft highlights: long, thin and only where the surface catches the light.
  float2 r = float2((x - center) * depth * 3.2, depth * 6.5 - time * flow * 1.6);
  float glint = smoothstep(0.62, 0.86, noise(r) * 0.7 + noise(r * 2.3 + 11.0) * 0.3);
  color += glint * (0.05 + 0.15 * d) * mix(1.0, 0.25 + moon * 0.6, night);

  // A little darker against the banks, where the water is shaded.
  color *= 1.0 - 0.14 * smoothstep(0.5, 1.0, edge);
  return half4(half3(clamp(color, 0.0, 1.0)) * alpha, alpha);
}
`;

export const waterEffect = Skia.RuntimeEffect.Make(source);

// Where the stream meets the lake: rings spreading out across the water, with foam at the mouth.
export const splashEffect = Skia.RuntimeEffect.Make(`
 uniform float time;
 uniform float2 center;
 uniform float2 extent;
 uniform float3 light;
 uniform float opacity;
 float rand(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
 float noise(float2 p) {
   float2 i = floor(p);
   float2 f = fract(p);
   f = f * f * (3.0 - 2.0 * f);
   return mix(mix(rand(i), rand(i + float2(1.0, 0.0)), f.x), mix(rand(i + float2(0.0, 1.0)), rand(i + float2(1.0, 1.0)), f.x), f.y);
 }
 half4 main(float2 p) {
   float2 q = (p - center) / extent;
   float r = length(q);
   if (r >= 1.0) return half4(0.0);
   float wobble = (noise(p * 0.12 + time * 0.3) - 0.5) * 0.12;
   float rings = pow(max(0.0, sin((r + wobble) * 18.0 - time * 3.0)), 5.0) * (1.0 - smoothstep(0.1, 1.0, r));
   float foam = smoothstep(0.55, 0.85, noise(p * 0.55 + float2(0.0, -time * 1.3))) * (1.0 - smoothstep(0.0, 0.3, r));
   float a = clamp(rings * 0.55 + foam * 0.85, 0.0, 1.0) * opacity;
   return half4(half3(light) * a, a);
 }`);
