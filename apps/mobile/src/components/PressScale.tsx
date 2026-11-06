import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { pressScale, spring } from '../theme/motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Layout of the touch area itself (alignSelf, flex), so it matches what's drawn. */
  outerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Scale target while pressed. Large surfaces use a gentler scale. */
  scaleTo?: number;
};

/** The shared press animation: everything pressable in the app scales to 0.95 on the shared spring. */
export function PressScale({ style, outerStyle, children, scaleTo = pressScale, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      {...rest}
      style={outerStyle}
      disabled={disabled}
      onPressIn={(event) => {
        scale.set(withSpring(scaleTo, spring));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, spring));
        onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}
