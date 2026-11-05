import { Skia } from '@shopify/react-native-skia';

// Mount Fuji, the lake with its reflection, and the rolling meadow, painted per pixel like the water.
// Light, snow and rock all come from one height field, so there are no outlines or flat fills. Run
// once per day and night into a cached image (see bake.ts), never per frame.
const source = `
uniform float2 size;
uniform float3 rockLit;
uniform float3 rockShade;
uniform float3 snowLit;
uniform float3 snowShade;
uniform float3 haze;
uniform float3 lake;
uniform float3 grassFar;
uniform float3 grassMid;
uniform float3 grassNear;
uniform float3 bank;
uniform float lightX;
uniform float summitY;
uniform float footY;
uniform float centerX;
uniform float bendStart;
uniform float bendGrowth;
uniform float bends;
uniform float widthStart;
uniform float widthGrowth;
uniform float widthPower;
uniform float streamTop;
uniform float streamBottom;

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

// Ridges run down the fall line: tight across the slope, long down it.
float ridge(float u, float t) {
  float n = fbm(float2(u * 6.5 + 0.35 * noise(float2(t * 5.0, u * 2.0)), t * 1.7 + 11.0));
  return 1.0 - abs(2.0 * n - 1.0);
}

float4 fuji(float2 q) {
  float t = (q.y - summitY) / (footY - summitY);
  if (t < 0.0 || t > 1.0) return float4(0.0);
  float dx = q.x - 0.5;
  float halfWidth = 0.04 + 0.49 * pow(t, 1.7);
  float wander = (noise(float2(q.y * 70.0, 3.0)) - 0.5) * 0.005;
  float edge = halfWidth + wander - abs(dx);
  float mask = smoothstep(0.0, 0.0035, edge);
  float u = dx / halfWidth;
  // A shallow crater dip across the flat summit.
  mask *= smoothstep(0.0, 0.006, t - 0.012 * max(1.0 - u * u, 0.0));
  if (mask <= 0.0) return float4(0.0);

  float h = ridge(u, t);
  float slope = ridge(u + 0.035, t) - ridge(u - 0.035, t);
  float lit = 0.5 + 0.4 * u * lightX + slope * 0.95 * lightX;

  // Gullies hold snow further down than ridges, and the line breaks up into fine tongues.
  float line = 0.5 + (fbm(float2(u * 4.5, 2.0)) - 0.5) * 0.3 + (0.5 - h) * 0.2
    + (noise(float2(u * 34.0, 7.0)) - 0.5) * 0.07 + (noise(float2(u * 80.0, t * 3.0)) - 0.5) * 0.03;
  float snow = 1.0 - smoothstep(line - 0.012, line + 0.012, t);

  float3 rock = mix(rockShade, rockLit, clamp(lit, 0.0, 1.0));
  rock *= 0.96 + 0.08 * noise(float2(u * 40.0, t * 30.0));
  float3 ice = mix(snowShade, snowLit, clamp(lit + 0.22, 0.0, 1.0));
  float3 c = mix(rock, ice, snow);

  // Light catches the edge facing it, and haze thickens toward the base because it is far away.
  c += smoothstep(0.022, 0.0, edge) * max(u * lightX, 0.0) * 0.16;
  c = mix(c, haze, 0.1 + 0.78 * smoothstep(0.34, 1.0, t));
  return float4(c, mask);
}

float crest(float x, float low, float high, float spread, float seed, float amount) {
  float valley = exp(-((x - 0.5) / spread) * ((x - 0.5) / spread));
  return mix(low, high, valley) + (fbm(float2(x * 3.2 + seed, seed)) - 0.5) * amount;
}

float3 meadow(float3 base, float2 p, float2 q, float top, float scale) {
  float patches = fbm(p * 0.021 * scale);
  float blades = noise(float2(p.x * 0.85 * scale, p.y * 0.42 * scale));
  float3 c = base * (0.8 + 0.38 * patches) * (0.96 + 0.08 * blades);
  // The crest of each rise catches the light, and the ground falls into shade below it.
  float below = q.y - top;
  c *= 1.14 - 0.24 * smoothstep(0.0, 0.12, below);
  return c;
}

half4 main(float2 p) {
  float2 q = p / size;
  float4 result = float4(0.0);

  float4 mountain = fuji(q);
  if (mountain.a > 0.0) result = float4(mountain.rgb, mountain.a);

  // The lake: a mirrored Fuji, broken up by small horizontal ripples.
  if (q.y >= footY) {
    float ripple = noise(float2(p.x * 0.05, p.y * 0.6)) - 0.5;
    float2 mirrored = float2(q.x + ripple * 0.006, footY - (q.y - footY) / 0.3);
    float4 reflected = fuji(mirrored);
    float3 water = mix(lake, haze, 0.25 + ripple * 0.12);
    water = mix(water, reflected.rgb, reflected.a * 0.62);
    water += smoothstep(0.62, 0.8, noise(float2(p.x * 0.05, p.y * 0.55))) * 0.05;
    result = float4(water, 1.0);
  }

  float x = q.x;
  float far = crest(x, 0.585, 0.725, 0.27, 2.0, 0.035);
  float mid = crest(x, 0.68, 0.79, 0.31, 7.0, 0.05);
  float near = crest(x, 0.77, 0.87, 0.36, 13.0, 0.05);

  // Each layer is richer and sharper than the one behind it.
  float3 layer = float3(0.0);
  float alpha = 0.0;
  if (q.y > far) { layer = mix(meadow(grassFar, p, q, far, 0.7), haze, 0.38); alpha = smoothstep(0.0, 0.006, q.y - far); }
  if (alpha > 0.0) result = float4(mix(result.rgb, layer, alpha), max(result.a, alpha));
  if (q.y > mid) { layer = mix(meadow(grassMid, p, q, mid, 1.0), haze, 0.12); alpha = smoothstep(0.0, 0.0045, q.y - mid); result = float4(mix(result.rgb, layer, alpha), 1.0); }
  if (q.y > near) { layer = meadow(grassNear, p, q, near, 1.5); alpha = smoothstep(0.0, 0.003, q.y - near); result = float4(mix(result.rgb, layer, alpha), 1.0); }

  // Damp soil fading out either side of the stream. The water shader draws on top of this.
  if (q.y >= streamTop) {
    float d = clamp((q.y - streamTop) / (streamBottom - streamTop), 0.0, 1.0);
    float center = centerX - (bendStart + bendGrowth * d) * sin(6.2831853 * bends * d);
    float halfW = (widthStart + widthGrowth * pow(d, widthPower)) * 0.5;
    float e = abs(x - center) / halfW;
    float soil = 1.0 - smoothstep(0.92, 1.42, e);
    result.rgb = mix(result.rgb, bank, soil * 0.62);
  }

  return half4(half3(clamp(result.rgb, 0.0, 1.0)) * result.a, result.a);
}
`;

export const landscapeEffect = Skia.RuntimeEffect.Make(source);
