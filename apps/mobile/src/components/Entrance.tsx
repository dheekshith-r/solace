import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { isLite } from '../lib/device';
import { duration, easing, entrance } from '../theme/motion';

/**
 * The shared page transition (spec 7.3): each block rises 18 px and fades in, 80 ms after the one
 * before, once per mount. Fade only with reduce motion; nothing at all in lite mode.
 */
export function Entrance({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const shown = useSharedValue(isLite ? 1 : 0);
  useEffect(() => {
    if (isLite) return;
    shown.set(withDelay(index * entrance.stagger, withTiming(1, { duration: duration.entrance, easing, reduceMotion: ReduceMotion.Never })));
  }, [index, shown]);
  // With reduce motion the content still fades in (spec 7.3), it just doesn't rise.
  const animated = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: reduced ? 0 : entrance.rise * (1 - shown.get()) }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
