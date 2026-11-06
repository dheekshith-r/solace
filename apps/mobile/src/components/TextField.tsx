import { CircleAlert, Eye, EyeOff } from 'lucide-react-native';
import { useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, easing } from '../theme/motion';
import { font, fontSize, kit, radius, spacing, touchTarget } from '../theme/tokens';
import { PressScale } from './PressScale';
import { Text } from './Text';
import { useFill, useTheme } from './ThemeProvider';

type Props = Omit<TextInputProps, 'style' | 'secureTextEntry' | 'ref'> & {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  label: string;
  error?: string;
  helper?: string;
  secure?: boolean;
};

/** Labelled input. Focus shows an accent ring that fades in; errors show inline below the field. */
export function TextField({ ref, label, error, helper, secure = false, onFocus, onBlur, ...rest }: Props) {
  const { palette } = useTheme();
  const fill = useFill();
  const [hidden, setHidden] = useState(secure);
  const focus = useSharedValue(0);
  const ring = useAnimatedStyle(() => ({ opacity: focus.get() }));
  const message = error ?? helper;

  return (
    <View style={styles.block}>
      <Text variant="footnoteStrong" tone="muted" importantForAccessibility="no">
        {label}
      </Text>
      <View style={[styles.field, { backgroundColor: fill }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor: error ? palette.muted : palette.accent }, error ? null : ring]}
        />
        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={hidden}
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholderTextColor={palette.muted}
          selectionColor={palette.accent}
          cursorColor={palette.accent}
          onFocus={(event) => {
            focus.set(withTiming(1, { duration: duration.quick, easing }));
            onFocus?.(event);
          }}
          onBlur={(event) => {
            focus.set(withTiming(0, { duration: duration.quick, easing }));
            onBlur?.(event);
          }}
          style={[styles.input, { color: palette.ink }]}
        />
        {secure ? (
          <PressScale
            onPress={() => setHidden(!hidden)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={spacing.sm}
            style={styles.eye}
          >
            {hidden ? <Eye size={kit.iconSmall} color={palette.muted} /> : <EyeOff size={kit.iconSmall} color={palette.muted} />}
          </PressScale>
        ) : null}
      </View>
      {message ? (
        <View style={styles.message} accessibilityLiveRegion={error ? 'polite' : 'none'}>
          {error ? <CircleAlert size={kit.iconSmall - spacing.xs} color={palette.ink} /> : null}
          <Text variant={error ? 'footnoteStrong' : 'footnote'} tone={error ? 'ink' : 'muted'} style={styles.flex}>
            {message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  field: {
    minHeight: kit.fieldHeight,
    borderRadius: radius.field,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  ring: { ...StyleSheet.absoluteFill, borderRadius: radius.field, borderWidth: kit.focusBorder },
  input: { flex: 1, fontFamily: font.regular, fontSize: fontSize.body, paddingVertical: spacing.md },
  eye: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.md },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + spacing.xs / 2 },
  flex: { flex: 1 },
});
