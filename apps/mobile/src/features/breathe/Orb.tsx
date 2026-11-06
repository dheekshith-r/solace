import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '../../components';
import { kit, opacity } from '../../theme/tokens';

/**
 * The breathing orb: one soft glowing circle in the accent, drawn once. `level` (0 small, 1 full)
 * drives only its scale on the UI thread. With reduce motion it brightens and dims instead.
 */
export function Orb({ level }: { level: SharedValue<number> }) {
  const { palette } = useTheme();
  const reduced = useReducedMotion();
  const size = kit.orb;
  const r = size / 2;
  const style = useAnimatedStyle(() =>
    reduced
      ? { opacity: opacity.skeletonLow + (1 - opacity.skeletonLow) * level.get() }
      : { transform: [{ scale: kit.orbSmall + (1 - kit.orbSmall) * level.get() }] },
  );
  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Circle cx={r} cy={r} r={r}>
            <RadialGradient c={vec(r, r)} r={r} colors={[palette.accent, `${palette.accent}99`, `${palette.accent}00`]} positions={[0, 0.55, 1]} />
          </Circle>
          <Circle cx={r} cy={r} r={r * 0.42} color={palette.accent} />
        </Canvas>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: 'center', justifyContent: 'center' } });
