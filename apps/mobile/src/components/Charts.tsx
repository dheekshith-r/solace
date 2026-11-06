import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { chart, kit, screenPadding, spacing } from '../theme/tokens';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

const COLS = 7;

/**
 * One star per active day over five weeks (decision 7): lit days glow in the accent, quiet days are
 * faint dots, and neighbouring lit days are joined, so a streak reads as a constellation.
 */
export function Constellation({ days }: { days: { day: string; lit: boolean }[] }) {
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const w = width - screenPadding * 2 - spacing.xl * 2;
  const rows = Math.ceil(days.length / COLS);
  const gapX = w / COLS;
  const gapY = kit.starRow;
  const pos = (i: number) => ({ x: gapX * (i % COLS) + gapX / 2, y: gapY * Math.floor(i / COLS) + gapY / 2 });
  const lit = days.filter((d) => d.lit).length;
  return (
    <View accessible accessibilityLabel={`${lit} of the last ${days.length} days have a star`}>
      <Svg width={w} height={rows * gapY}>
        {days.map((d, i) => {
          const next = days[i + 1];
          if (!d.lit || !next?.lit || (i + 1) % COLS === 0) return null;
          const a = pos(i);
          const b = pos(i + 1);
          return <Line key={`l${d.day}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={palette.accent} strokeOpacity={chart.joinOpacity} strokeWidth={chart.joinWidth} />;
        })}
        {days.map((d, i) => {
          const p = pos(i);
          return d.lit ? (
            <G key={d.day}>
              <Circle cx={p.x} cy={p.y} r={kit.starGlow} fill={palette.accent} fillOpacity={chart.glowOpacity} />
              <Circle cx={p.x} cy={p.y} r={kit.star} fill={palette.accent} />
            </G>
          ) : (
            <Circle key={d.day} cx={p.x} cy={p.y} r={kit.starQuiet} fill={palette.muted} fillOpacity={chart.quietOpacity} />
          );
        })}
      </Svg>
    </View>
  );
}

/** Mood over two weeks: a soft line that fades at both ends, with gaps for days without a check-in. */
export function MoodTrend({ points }: { points: (number | null)[] }) {
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const w = width - screenPadding * 2 - spacing.xl * 2;
  const h = kit.trendHeight;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const y = (mood: number) => h - ((mood - 1) / 4) * (h - kit.star * 2) - kit.star;
  let d = '';
  points.forEach((m, i) => {
    if (m === null) return;
    const prev = points[i - 1];
    d += `${prev === null || prev === undefined ? 'M' : 'L'}${(i * step).toFixed(1)} ${y(m).toFixed(1)} `;
  });
  const known = points.filter((p): p is number => p !== null);
  const label = known.length ? `Mood over two weeks, ${known.length} days noted, latest ${Math.round(known[known.length - 1] ?? 3)} of 5` : 'No moods noted in the last two weeks yet';
  return (
    <View accessible accessibilityLabel={label}>
      {known.length ? (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
              <Stop offset={0} stopColor={palette.accent} stopOpacity={chart.fadeEdge} />
              <Stop offset={chart.fadeEdge} stopColor={palette.accent} stopOpacity={1} />
              <Stop offset={1 - chart.fadeEdge} stopColor={palette.accent} stopOpacity={1} />
              <Stop offset={1} stopColor={palette.accent} stopOpacity={chart.fadeEnd} />
            </LinearGradient>
          </Defs>
          <Path d={d} stroke="url(#fade)" strokeWidth={chart.lineWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {points.map((m, i) => (m === null ? null : <Circle key={i} cx={i * step} cy={y(m)} r={kit.star - 1} fill={palette.accent} />))}
        </Svg>
      ) : (
        <View style={[styles.empty, { height: h }]}>
          <Text variant="callout" tone="muted" center>
            Check in on Today and your two weeks will draw here.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ empty: { alignItems: 'center', justifyContent: 'center' } });
