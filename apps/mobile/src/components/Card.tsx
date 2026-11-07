import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { pressScaleGentle } from '../theme/motion';
import { radius, spacing } from '../theme/tokens';
import { PressScale } from './PressScale';
import { Raised, useFill } from './ThemeProvider';

/**
 * A surface: white on the page (dark gray in dark mode), a soft tint when nested inside another surface. `hero` uses the petal shape (one tighter corner) for the one card a
 * screen leads with. Pass `onPress` to make the whole card pressable.
 */
export function Card({
  children,
  hero = false,
  onPress,
  accessibilityLabel,
  testID,
  style,
}: {
  children: ReactNode;
  hero?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** For the phone tests; pressable cards on the main screens set one, e.g. `card-breathe`. */
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const fill = useFill();
  const surface = [styles.card, hero ? styles.hero : null, { backgroundColor: fill }, style];
  const content = <Raised>{children}</Raised>;
  if (!onPress) return <View style={surface}>{content}</View>;
  return (
    <PressScale
      onPress={onPress}
      scaleTo={pressScaleGentle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={surface}
    >
      {content}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: spacing.xl, gap: spacing.sm },
  hero: {
    borderRadius: radius.hero,
    borderBottomRightRadius: radius.petal,
    padding: spacing.xxl,
  },
});
