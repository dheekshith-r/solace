import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { pressScaleGentle } from '../theme/motion';
import { kit, radius, separatorInset, spacing } from '../theme/tokens';
import { PressScale } from './PressScale';
import { Text } from './Text';
import { Raised, useFill, useTheme } from './ThemeProvider';

type Trailing = { kind: 'chevron' } | { kind: 'value'; value: string } | { kind: 'switch'; on: boolean; onChange: (on: boolean) => void } | { kind: 'none' };

/** One row in a grouped list: icon, title, optional subtitle, and a chevron, value or switch. */
export function ListRow({
  icon: Icon,
  title,
  subtitle,
  trailing = { kind: 'chevron' },
  destructive = false,
  onPress,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  trailing?: Trailing;
  destructive?: boolean;
  onPress?: () => void;
}) {
  const { palette } = useTheme();
  const fill = useFill();
  const tone = destructive ? 'destructive' : 'ink';
  const content = (
    <View style={styles.row}>
      {Icon ? (
        <View style={[styles.iconWell, { backgroundColor: fill }]}>
          <Icon size={kit.iconSmall} color={destructive ? palette.destructive : palette.ink} strokeWidth={kit.iconStroke} />
        </View>
      ) : null}
      <View style={styles.words}>
        <Text variant="body" tone={tone} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing.kind === 'value' ? (
        <Text variant="callout" tone="muted">
          {trailing.value}
        </Text>
      ) : null}
      {trailing.kind === 'switch' ? (
        <Switch
          value={trailing.on}
          onValueChange={trailing.onChange}
          trackColor={{ false: palette.separator, true: palette.accent }}
          thumbColor={palette.surface}
          accessibilityLabel={title}
        />
      ) : null}
      {trailing.kind === 'chevron' || (trailing.kind === 'value' && onPress) ? (
        <ChevronRight size={kit.iconSmall} color={palette.muted} />
      ) : null}
    </View>
  );

  const label = [title, subtitle, trailing.kind === 'value' ? trailing.value : undefined].filter(Boolean).join(', ');
  if (!onPress || trailing.kind === 'switch') {
    return (
      <View accessible={trailing.kind !== 'switch'} accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <PressScale
      onPress={onPress}
      scaleTo={pressScaleGentle}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </PressScale>
  );
}

/** Rows grouped on one surface, with inset hairline separators between them. */
export function ListGroup({ children, header }: { children: ReactNode; header?: string }) {
  const { palette } = useTheme();
  const fill = useFill();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.groupBlock}>
      {header ? (
        <Text variant="footnoteStrong" tone="muted" style={styles.groupHeader} accessibilityRole="header">
          {header}
        </Text>
      ) : null}
      <View style={[styles.group, { backgroundColor: fill }]}>
        <Raised>
        {rows.map((row, index) => (
          <View key={row.key ?? index}>
            {index > 0 ? <View style={[styles.separator, { backgroundColor: palette.separator }]} /> : null}
            {row}
          </View>
        ))}
        </Raised>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: kit.rowMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconWell: {
    width: kit.iconWell,
    height: kit.iconWell,
    borderRadius: radius.field - spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, gap: spacing.xs / 2 },
  groupBlock: { gap: spacing.sm },
  groupHeader: { paddingHorizontal: spacing.lg },
  group: { borderRadius: radius.card, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: separatorInset },
});
