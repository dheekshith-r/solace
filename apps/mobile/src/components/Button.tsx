import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { haptics } from '../theme/haptics';
import { kit, opacity, radius, spacing, type Palette } from '../theme/tokens';
import { PressScale } from './PressScale';
import { testId } from './testId';
import { Text, type TextTone } from './Text';
import { useFill, useTheme } from './ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'text';

const look = (palette: Palette, fill: string, variant: ButtonVariant): { background?: string; tone: TextTone; color: string } => {
  if (variant === 'primary') return { background: palette.accent, tone: 'onAccent', color: palette.onAccent };
  if (variant === 'secondary') return { background: fill, tone: 'ink', color: palette.ink };
  return { tone: 'accent', color: palette.accent };
};

/** Primary (one per screen), secondary, or text. Shows a small spinner inside while loading. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  loading = false,
  disabled = false,
  wide = false,
  align = 'start',
  accessibilityHint,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  wide?: boolean;
  /** Where a non-wide button sits in a column. The touch area always hugs the button. */
  align?: 'start' | 'center';
  accessibilityHint?: string;
  /** Defaults to `button-<label>`; set it where two buttons on one screen share a label. */
  testID?: string;
}) {
  const { palette } = useTheme();
  const fill = useFill();
  const { background, tone, color } = look(palette, fill, variant);
  const inactive = disabled || loading;
  return (
    <PressScale
      onPress={() => {
        if (variant === 'primary') haptics.light();
        onPress();
      }}
      disabled={inactive}
      outerStyle={wide ? styles.wide : align === 'center' ? styles.hugCenter : styles.hug}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID ?? testId('button', label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.button,
        variant === 'text' ? styles.textButton : null,
        { backgroundColor: background, opacity: disabled ? opacity.disabled : 1 },
      ]}
    >
      <View style={[styles.content, loading ? styles.hidden : null]}>
        {Icon ? <Icon size={kit.iconSmall} color={color} strokeWidth={kit.iconStrokeBold} /> : null}
        <Text variant="calloutStrong" tone={tone} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {loading ? <ActivityIndicator style={StyleSheet.absoluteFill} color={color} /> : null}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: kit.buttonHeight,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: { paddingHorizontal: spacing.md, minHeight: kit.chipHeight + spacing.sm },
  wide: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  hugCenter: { alignSelf: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hidden: { opacity: 0 },
});
