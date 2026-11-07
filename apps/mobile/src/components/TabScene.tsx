import { useFocusEffect } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, easing } from '../theme/motion';
import { useTheme } from './ThemeProvider';

/**
 * A tab's page. It fades itself in over the previous tab, which stays solid underneath, so the old
 * tab never shows on top. Opaque, and composited offscreen while fading, so on Android its layers
 * (a row and the bin behind it) never show through each other mid-fade (Ddk, Nov 7).
 */
export function TabScene({ children }: { children: ReactNode }) {
  const { palette } = useTheme();
  const shown = useSharedValue(1);
  useFocusEffect(
    useCallback(() => {
      shown.set(withTiming(1, { duration: duration.tabFade, easing }));
      // Hidden while away, so the next visit starts from clear rather than flashing in.
      return () => shown.set(0);
    }, [shown]),
  );
  const style = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return (
    <Animated.View style={[styles.scene, { backgroundColor: palette.background }, style]} needsOffscreenAlphaCompositing>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ scene: { flex: 1 } });
