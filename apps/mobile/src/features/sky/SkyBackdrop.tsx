import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { skyStopPositions } from '../../theme/sky';
import { minuteOfDay } from './astro';
import { rgbToCss, skyTextIsWhite, timeStops } from './skyColors';

/** Whether text on the sky should be white right now. Screens on the backdrop pick their scheme from it. */
export function skySchemeNow(minute?: number): 'light' | 'dark' {
  return skyTextIsWhite(minute ?? minuteOfDay(new Date())) ? 'dark' : 'light';
}

/** The sky's gradient for the current time of day, drawn once and static. Behind onboarding and Reflect. */
export function SkyBackdrop({ minute }: { minute?: number }) {
  const { width, height } = useWindowDimensions();
  const colors = timeStops(minute ?? minuteOfDay(new Date())).map(rgbToCss);
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={colors} positions={[...skyStopPositions]} />
      </Rect>
    </Canvas>
  );
}
