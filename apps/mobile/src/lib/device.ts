import * as Device from 'expo-device';

const LITE_MODE_BYTES = 4 * 1024 ** 3;

/** Lite mode: phones under about 4 GB of RAM skip stagger, idle float and moving scenery (spec 7.3). */
export const isLite = (Device.totalMemory ?? LITE_MODE_BYTES) < LITE_MODE_BYTES;
