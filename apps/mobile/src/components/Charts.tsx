import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { chart, kit, opacity, radius, screenPadding, spacing } from '../theme/tokens';
import { PressScale } from './PressScale';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function MonthArrow({ dir, disabled, color, onPress }: { dir: -1 | 1; disabled: boolean; color: string; onPress: () => void }) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={dir === 1 ? 'Next month' : 'Previous month'}
      testID={dir === 1 ? 'calendar-next' : 'calendar-previous'}
      style={[styles.arrow, disabled ? styles.faint : null]}
    >
      <Icon size={kit.icon} color={color} />
    </PressScale>
  );
}

/**
 * A month of check-ins, like a phone calendar: today ringed, check-in days filled in the accent.
 * `today` is the user's local "YYYY-MM-DD"; `active` holds local days with a check-in.
 */
export function MonthCalendar({ today, active, monthsBack = 5 }: { today: string; active: ReadonlySet<string>; monthsBack?: number }) {
  const { palette } = useTheme();
  const [offset, setOffset] = useState(0);
  const [ty = 2026, tm = 1] = today.split('-').map(Number);
  const first = new Date(Date.UTC(ty, tm - 1 - offset, 1));
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Monday-first grid: Sunday (0) sits in the last column.
  const lead = (first.getUTCDay() + 6) % 7;
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const count = Array.from({ length: daysIn }, (_, i) => iso(year, month, i + 1)).filter((d) => active.has(d)).length;

  return (
    <View style={styles.calendar}>
      <View style={styles.monthRow}>
        <MonthArrow dir={-1} disabled={offset >= monthsBack} color={palette.accent} onPress={() => setOffset(offset + 1)} />
        <Text variant="bodyStrong" accessibilityLiveRegion="polite" accessibilityLabel={`${MONTHS[month]} ${year}, ${count} check-in days`}>
          {MONTHS[month]} {year}
        </Text>
        <MonthArrow dir={1} disabled={offset === 0} color={palette.accent} onPress={() => setOffset(offset - 1)} />
      </View>
      <View style={styles.week} importantForAccessibility="no-hide-descendants">
        {WEEKDAYS.map((d, i) => (
          <Text key={i} variant="footnote" tone="muted" center style={styles.cell}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid} importantForAccessibility="no-hide-descendants">
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={styles.cell} />;
          const day = iso(year, month, d);
          const on = active.has(day);
          const isToday = day === today;
          return (
            <View key={day} style={styles.cell}>
              <View style={[styles.dayDot, on ? { backgroundColor: palette.accent } : null, isToday && !on ? { borderColor: palette.accent, borderWidth: chart.todayRing } : null]}>
                <Text variant={isToday ? 'footnoteStrong' : 'footnote'} tone={on ? 'onAccent' : isToday ? 'accent' : 'ink'}>
                  {d}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Mood over two weeks, with weekday letters under each day. Needs a few days of data to mean anything. */
export function MoodTrend({ points, days }: { points: (number | null)[]; days: string[] }) {
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const w = width - screenPadding * 2 - spacing.xl * 2;
  const h = kit.trendHeight;
  // Inset so the first and last dots never sit on the card's edge.
  const pad = kit.starGlow;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const x = (i: number) => pad + i * step;
  const y = (mood: number) => h - ((mood - 1) / 4) * (h - pad * 2) - pad;
  const known = points.filter((p): p is number => p !== null);

  if (known.length < chart.trendMinDays) {
    return (
      <View style={[styles.empty, { height: h }]} accessible accessibilityLabel="Not enough check-ins yet for a mood trend">
        <Text variant="callout" tone="muted" center>
          Check in a few days to see your mood trend.
        </Text>
      </View>
    );
  }

  let d = '';
  points.forEach((m, i) => {
    if (m === null) return;
    d += `${d ? 'L' : 'M'}${x(i).toFixed(1)} ${y(m).toFixed(1)} `;
  });
  return (
    <View accessible accessibilityLabel={`Mood over two weeks, ${known.length} days noted, latest ${Math.round(known[known.length - 1] ?? 3)} of 5`}>
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={palette.accent} stopOpacity={chart.glowOpacity} />
            <Stop offset={1} stopColor={palette.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[1, 3, 5].map((m) => (
          <Line key={m} x1={pad} x2={w - pad} y1={y(m)} y2={y(m)} stroke={palette.separator} strokeWidth={StyleSheet.hairlineWidth} />
        ))}
        <Path d={d} stroke={palette.accent} strokeWidth={chart.lineWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {points.map((m, i) => (m === null ? null : <Circle key={i} cx={x(i)} cy={y(m)} r={kit.star} fill={palette.accent} />))}
      </Svg>
      <View style={[styles.labels, { paddingHorizontal: pad - kit.trendLabel / 2 }]} importantForAccessibility="no-hide-descendants">
        {days.map((day, i) => (
          <Text key={day} variant="caption" tone={i === days.length - 1 ? 'accent' : 'muted'} center style={{ width: kit.trendLabel }}>
            {WEEKDAYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7]}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: kit.calendarCell, height: kit.calendarCell, alignItems: 'center', justifyContent: 'center' },
  faint: { opacity: opacity.disabled },
  week: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: kit.calendarCell, alignItems: 'center', justifyContent: 'center' },
  dayDot: { width: kit.calendarDot, height: kit.calendarDot, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
});
