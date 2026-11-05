import { Skia } from '@shopify/react-native-skia';

const noiseLib = `
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
float fbm(float2 p) {
  return 0.5 * noise(p) + 0.27 * noise(p * 2.03 + 3.1) + 0.15 * noise(p * 4.1 + 7.7) + 0.08 * noise(p * 8.3 + 1.9);
}
`;

// Bark: long fissures running along the wood, with light and dark flecks.
export const barkEffect = Skia.RuntimeEffect.Make(`
uniform float3 dark;
uniform float3 light;
${noiseLib}
half4 main(float2 p) {
  float fissure = fbm(float2(p.x * 0.28, p.y * 1.9));
  float grain = noise(float2(p.x * 0.9, p.y * 5.0));
  float tone = smoothstep(0.3, 0.72, fissure) * 0.8 + grain * 0.2;
  return half4(half3(mix(dark, light, tone)), 1.0);
}`);

// A cloud: soft overlapping lobes of density, brighter on top and darker beneath, thin at the edges.
export const cloudEffect = Skia.RuntimeEffect.Make(`
uniform float2 size;
uniform float seed;
uniform float3 top;
uniform float3 under;
uniform float3 rim;
uniform float opacity;
uniform float rimAmount;
${noiseLib}
float density(float2 p) {
  float2 q = p / size;
  float across = (q.x - 0.5) / 0.46;
  float down = (q.y - 0.56) / 0.4;
  float shape = 1.0 - across * across - down * down * (down < 0.0 ? 0.55 : 1.5);
  float n = fbm(p * 0.03 + seed) * 0.72 + fbm(p * 0.085 + seed * 2.3) * 0.28;
  return smoothstep(0.34, 0.86, shape * 0.62 + n * 0.72);
}
half4 main(float2 p) {
  float d = density(p);
  if (d <= 0.001) return half4(0.0);
  // Shading from above: how much cloud sits between this point and the light.
  float toLight = density(p + float2(3.0, -8.0));
  float lit = clamp(0.62 + (d - toLight) * 2.4, 0.0, 1.0);
  float3 c = mix(under, top, lit);
  c += rim * rimAmount * smoothstep(0.62, 0.95, lit) * smoothstep(0.02, 0.4, d) * (1.0 - smoothstep(0.4, 0.95, d));
  float a = d * d * (3.0 - 2.0 * d) * opacity;
  return half4(half3(clamp(c, 0.0, 1.0)) * a, a);
}`);

// The moon: smooth maria from soft-edged pools, faint rays, and a darker limb.
export const moonEffect = Skia.RuntimeEffect.Make(`
uniform float radius;
uniform float3 highland;
uniform float3 mare;
${noiseLib}
float pool(float2 q, float2 c, float2 r, float seed) {
  float2 d = (q - c) / r;
  float w = (noise(q * 5.0 + seed) - 0.5) * 0.5;
  return 1.0 - smoothstep(0.1, 1.35, length(d) + w);
}
half4 main(float2 p) {
  float2 q = (p - float2(radius + 2.0)) / radius;
  float dist = length(q);
  float a = 1.0 - smoothstep(0.985, 1.0, dist);
  if (a <= 0.0) return half4(0.0);
  float m = 0.0;
  m = max(m, pool(q, float2(-0.34, -0.36), float2(0.34, 0.31), 1.0));
  m = max(m, pool(q, float2(0.12, -0.38), float2(0.21, 0.19), 2.0));
  m = max(m, pool(q, float2(0.32, -0.1), float2(0.27, 0.21), 3.0));
  m = max(m, pool(q, float2(0.68, -0.32), float2(0.14, 0.12), 4.0));
  m = max(m, pool(q, float2(0.62, 0.12), float2(0.17, 0.23), 5.0));
  m = max(m, pool(q, float2(-0.62, -0.02), float2(0.28, 0.44), 6.0));
  m = max(m, pool(q, float2(-0.42, 0.42), float2(0.15, 0.14), 7.0));
  m = max(m, pool(q, float2(-0.12, 0.36), float2(0.26, 0.18), 8.0));
  float3 c = mix(highland, mare, m * 0.3);
  c *= 0.97 + 0.06 * fbm(q * 9.0);
  // Tycho's bright rays, very faint.
  float2 t = q - float2(-0.06, 0.7);
  float rays = pow(max(0.0, sin(atan(t.y, t.x) * 9.0)), 6.0) * (1.0 - smoothstep(0.0, 0.8, length(t)));
  c += rays * 0.06;
  c *= 1.0 - 0.16 * smoothstep(0.7, 1.0, dist);
  return half4(half3(clamp(c, 0.0, 1.0)) * a, a);
}`);
