// Sky calculations. All of it runs on-device with no network or location access.

import { skyTimes } from '../../theme/sky';

const SYNODIC_MONTH_DAYS = 29.530588853;
// A reference new moon: 6 January 2000, 18:14 UTC.
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
const MS_PER_DAY = 86_400_000;

/** Fraction through the lunar cycle: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonPhase(atMs: number): number {
  const days = (atMs - REFERENCE_NEW_MOON_MS) / MS_PER_DAY;
  const cycles = days / SYNODIC_MONTH_DAYS;
  return cycles - Math.floor(cycles);
}

/** Lit fraction of the moon's disc, 0 to 1. */
export function moonIllumination(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** SVG path of the lit part of a moon of radius r centered on the origin. */
export function moonLitPath(phase: number, r: number): string {
  const waxing = phase < 0.5;
  const crescent = phase < 0.25 || phase > 0.75;
  const terminator = Math.abs(Math.cos(2 * Math.PI * phase)) * r;
  // The outer edge is a half circle on the lit side. The terminator is half an ellipse.
  const outerSweep = waxing ? 1 : 0;
  const innerSweep = waxing === crescent ? 0 : 1;
  return `M0 ${-r} A${r} ${r} 0 0 ${outerSweep} 0 ${r} A${terminator} ${r} 0 0 ${innerSweep} 0 ${-r} Z`;
}

export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function wrapMinute(minute: number): number {
  'worklet';
  return ((minute % 1440) + 1440) % 1440;
}

/** How far the sun has crossed the sky, 0 at sunrise and 1 at sunset. Outside 0..1 it has set. */
export function sunProgress(minute: number): number {
  'worklet';
  return (wrapMinute(minute) - skyTimes.sunrise) / (skyTimes.sunset - skyTimes.sunrise);
}

/** How far the moon has crossed the sky, 0 at sunset, 0.5 at midnight, 1 at sunrise. */
export function moonProgress(minute: number): number {
  'worklet';
  const m = wrapMinute(minute);
  const night = 1440 - skyTimes.sunset + skyTimes.sunrise;
  return (m >= skyTimes.sunset ? m - skyTimes.sunset : m + 1440 - skyTimes.sunset) / night;
}

/** A point on the one big circle both bodies share: 0 off the left edge, 0.5 at the top, 1 off the right. */
export function skyArc(progress: number, width: number, apexY: number, endY: number, overscan: number) {
  'worklet';
  const p = Math.min(1, Math.max(0, progress));
  const halfChord = width * (0.5 + overscan);
  const rise = endY - apexY;
  const radius = (halfChord * halfChord + rise * rise) / (2 * rise);
  const half = Math.asin(halfChord / radius);
  const angle = -half + 2 * half * p;
  return { x: width / 2 + radius * Math.sin(angle), y: apexY + radius - radius * Math.cos(angle) };
}

/** 0 awake, 1 asleep, easing over a few minutes at each end so Sola's eyes never snap. */
export function sleepyAmount(minute: number): number {
  'worklet';
  const m = wrapMinute(minute);
  const ramp = skyTimes.sleepyRamp;
  if (m >= skyTimes.sleepyFrom) return Math.min(1, (m - skyTimes.sleepyFrom) / ramp);
  if (m < skyTimes.sleepyUntil) return Math.min(1, (skyTimes.sleepyUntil - m) / ramp);
  return 0;
}

export function isSleepy(minute: number): boolean {
  'worklet';
  const m = wrapMinute(minute);
  return m >= skyTimes.sleepyFrom || m < skyTimes.sleepyUntil;
}
