import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { kit, radius, screenPadding, spacing } from '../theme/tokens';
import { ROOT_ID } from './testId';
import { Text } from './Text';
import { Raised, useTheme } from './ThemeProvider';

/**
 * Content of a sheet route (expo-router `presentation: 'formSheet'`). Draws its own grabber,
 * because the native one is iOS only.
 */
export function Sheet({ title, children }: { title?: string; children: ReactNode }) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sheet, { backgroundColor: palette.surface, paddingBottom: insets.bottom + spacing.xl }]} testID={ROOT_ID} collapsable={false}>
      <View style={[styles.grabber, { backgroundColor: palette.separator }]} accessibilityElementsHidden importantForAccessibility="no" />
      {title ? (
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Raised>{children}</Raised>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: kit.grabberWidth,
    height: kit.grabberHeight,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
});
