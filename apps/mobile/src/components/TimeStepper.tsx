import { Minus, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { haptics } from '../theme/haptics';
import { kit, radius, spacing, touchTarget } from '../theme/tokens';
import { PressScale } from './PressScale';
import { Text } from './Text';
import { useFill, useTheme } from './ThemeProvider';

const MINUTE_STEP = 15;

/** "HH:MM" plus or minus some minutes, wrapping around midnight. Pure, so it's tested. */
export function shiftTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = ((((h ?? 0) * 60 + (m ?? 0) + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function Step({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress: () => void }) {
  const { palette } = useTheme();
  const fill = useFill();
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.step, { backgroundColor: fill }]}>
      <Icon size={kit.iconSmall} color={palette.ink} />
    </PressScale>
  );
}

/** Pick a time with big, calm steps: an hour or 15 minutes at a time. */
export function TimeStepper({ value, onChange, label }: { value: string; onChange: (time: string) => void; label: string }) {
  const change = (minutes: number) => {
    haptics.selection();
    onChange(shiftTime(value, minutes));
  };
  return (
    <View style={styles.row} accessible={false}>
      <View style={styles.group}>
        <Step icon={Minus} label={`${label}: one hour earlier`} onPress={() => change(-60)} />
        <Step icon={Minus} label={`${label}: 15 minutes earlier`} onPress={() => change(-MINUTE_STEP)} />
      </View>
      <Text variant="title" accessibilityLiveRegion="polite" accessibilityLabel={`${label} at ${value}`}>
        {value}
      </Text>
      <View style={styles.group}>
        <Step icon={Plus} label={`${label}: 15 minutes later`} onPress={() => change(MINUTE_STEP)} />
        <Step icon={Plus} label={`${label}: one hour later`} onPress={() => change(60)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  group: { flexDirection: 'row', gap: spacing.xs },
  step: { width: touchTarget, height: touchTarget, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
