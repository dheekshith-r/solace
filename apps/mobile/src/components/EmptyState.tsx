import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { kit, radius, spacing } from '../theme/tokens';
import { Button } from './Button';
import { Text } from './Text';
import { useFill, useTheme } from './ThemeProvider';

/** Nothing here yet: says so warmly and offers the one next step. Also used for errors, with a retry. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' };
}) {
  const { palette } = useTheme();
  const fill = useFill();
  return (
    <View style={styles.block}>
      <View style={[styles.well, { backgroundColor: fill }]}>
        <Icon size={kit.icon + spacing.sm} color={palette.accent} strokeWidth={kit.iconStrokeLight} />
      </View>
      <View style={styles.words}>
        <Text variant="heading" center accessibilityRole="header">
          {title}
        </Text>
        <Text variant="callout" tone="muted" center>
          {body}
        </Text>
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} variant={action.variant ?? 'primary'} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', gap: spacing.xl, paddingVertical: spacing.huge, paddingHorizontal: spacing.lg },
  well: { width: kit.emptyIcon, height: kit.emptyIcon, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  words: { gap: spacing.sm, alignItems: 'center' },
});
