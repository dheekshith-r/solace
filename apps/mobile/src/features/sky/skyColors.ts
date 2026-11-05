// Sky color and text contrast calculations. Pure, so tests can check every minute of the day.

import {
  moodBrightPerLevel,
  moodDimPerLevel,
  moodNeutral,
  skyKeyframes,
  skyTimes,
  type Stops,
} from '../../theme/sky';
import { wrapMinute } from './astro';

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  'worklet';
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  'worklet';
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function rgbToCss(c: Rgb): string {
  'worklet';
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

function blendStops(a: Stops, b: Stops, t: number): Rgb[] {
  'worklet';
  return [0, 1, 2, 3].map((i) => mixRgb(hexToRgb(a[i] as string), hexToRgb(b[i] as string), t));
}

function progress(m: number, from: number, to: number): number {
  'worklet';
  return (m - from) / (to - from);
}

/** The sky's four colors for a time of day, before mood. */
export function timeStops(minute: number): Rgb[] {
  'worklet';
  const m = wrapMinute(minute);
  const { night, dawn, day, dusk } = skyKeyframes;
  const { dawnStart, dayStart, duskStart, nightStart } = skyTimes;
  if (m < dawnStart || m >= nightStart) return blendStops(night, night, 0);
  if (m < skyTimes.dawn) return blendStops(night, dawn, progress(m, dawnStart, skyTimes.dawn));
  if (m < dayStart) return blendStops(dawn, day, progress(m, skyTimes.dawn, dayStart));
  if (m < duskStart) return blendStops(day, day, 0);
  if (m < skyTimes.dusk) return blendStops(day, dusk, progress(m, duskStart, skyTimes.dusk));
  return blendStops(dusk, night, progress(m, skyTimes.dusk, nightStart));
}

/** The sky's four colors for a time of day and a mood. Mood can be between levels mid-drag. */
export function skyStops(minute: number, mood: number): Rgb[] {
  'worklet';
  const levels = mood - moodNeutral;
  const target: Rgb = levels < 0 ? [0, 0, 0] : [255, 255, 255];
  const amount = levels < 0 ? -levels * moodDimPerLevel : levels * moodBrightPerLevel;
  return timeStops(minute).map((c) => mixRgb(c, target, amount));
}

/** 1 at full night, 0 in the daytime sky. */
export function nightAmount(minute: number): number {
  'worklet';
  const m = wrapMinute(minute);
  const { dawnStart, dayStart, duskStart, nightStart } = skyTimes;
  if (m < dawnStart || m >= nightStart) return 1;
  if (m < dayStart) return 1 - progress(m, dawnStart, dayStart);
  if (m < duskStart) return 0;
  return progress(m, duskStart, nightStart);
}

function channel(v: number): number {
  'worklet';
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(c: Rgb): number {
  'worklet';
  return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
}

export function contrastWith(c: Rgb, textIsWhite: boolean): number {
  'worklet';
  const l = luminance(c);
  return textIsWhite ? 1.05 / (l + 0.05) : (l + 0.05) / 0.05;
}

/** Text on the sky is black or white, whichever passes best across the two headline stops. */
export function skyTextIsWhite(minute: number, mood: number): boolean {
  'worklet';
  const stops = skyStops(minute, mood);
  const top = stops[0] as Rgb;
  const lower = stops[1] as Rgb;
  const white = Math.min(contrastWith(top, true), contrastWith(lower, true));
  const black = Math.min(contrastWith(top, false), contrastWith(lower, false));
  return white > black;
}

/** Contrast of the chosen text color on the headline's part of the sky. */
export function skyTextContrast(minute: number, mood: number): number {
  'worklet';
  const stops = skyStops(minute, mood);
  const useWhite = skyTextIsWhite(minute, mood);
  return Math.min(contrastWith(stops[0] as Rgb, useWhite), contrastWith(stops[1] as Rgb, useWhite));
}

export function contrastBetween(a: string, b: string): number {
  const [x, y] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
