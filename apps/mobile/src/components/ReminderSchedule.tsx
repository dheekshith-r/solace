import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { Chip } from './Chip';
import { ListRow } from './ListRow';

// Monday first, as people read a week; values are Android's weekday numbers (1 = Sunday).
const WEEK = [
  { day: 2, short: 'M', name: 'Monday' },
  { day: 3, short: 'T', name: 'Tuesday' },
  { day: 4, short: 'W', name: 'Wednesday' },
  { day: 5, short: 'T', name: 'Thursday' },
  { day: 6, short: 'F', name: 'Friday' },
  { day: 7, short: 'S', name: 'Saturday' },
  { day: 1, short: 'S', name: 'Sunday' },
] as const;

/** "13:05" → "1:05 PM". */
export function formatTime12(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Every day at 1:00 PM", "Mon, Wed at 9:00 AM". */
export function describeSchedule(time: string, days?: readonly number[]): string {
  const when = !days || days.length === 7 ? 'Every day' : WEEK.filter((w) => days.includes(w.day)).map((w) => w.name.slice(0, 3)).join(', ');
  return `${when} at ${formatTime12(time)}`;
}

export type Schedule = { time: string; days?: number[] };

/** A reminder's time (Android's wheel picker) and the days it repeats. No days = every day. */
export function ReminderSchedule({ value, onChange, label }: { value: Schedule; onChange: (next: Schedule) => void; label: string }) {
  const everyDay = !value.days || value.days.length === 7;
  const pickTime = () => {
    const [h = 0, m = 0] = value.time.split(':').map(Number);
    const at = new Date();
    at.setHours(h, m, 0, 0);
    DateTimePickerAndroid.open({
      value: at,
      mode: 'time',
      display: 'spinner',
      is24Hour: false,
      onChange: (event, picked) => {
        if (event.type !== 'set' || !picked) return;
        onChange({ ...value, time: `${String(picked.getHours()).padStart(2, '0')}:${String(picked.getMinutes()).padStart(2, '0')}` });
      },
    });
  };
  const toggle = (day: number) => {
    const current = everyDay ? WEEK.map((w) => w.day) : [...(value.days ?? [])];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    // At least one day; all seven is "every day".
    if (next.length === 0) return;
    onChange({ ...value, days: next.length === 7 ? undefined : next });
  };
  return (
    <View style={styles.block}>
      <ListRow title="Time" trailing={{ kind: 'value', value: formatTime12(value.time) }} onPress={pickTime} />
      <View style={styles.days} accessibilityLabel={`${label}: days`}>
        <Chip label="Every day" selected={everyDay} onPress={() => onChange({ ...value, days: undefined })} />
        {WEEK.map((w) => (
          <Chip key={w.day} label={w.short} a11yLabel={w.name} selected={everyDay || (value.days ?? []).includes(w.day)} onPress={() => toggle(w.day)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
