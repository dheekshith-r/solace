import { minuteOfDay } from './astro';
import { skyTextIsWhite } from './skyColors';

/** Light or dark for the sky at a minute of the day (now, by default). Pure: no drawing code. */
export function skySchemeNow(minute?: number): 'light' | 'dark' {
  return skyTextIsWhite(minute ?? minuteOfDay(new Date())) ? 'dark' : 'light';
}