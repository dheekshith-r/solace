import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { haptics } from '../theme/haptics';
import { kit, radius, spacing } from '../theme/tokens';
import { PressScale } from './PressScale';
import { testId } from './testId';
import { Text } from './Text';
import { useFill, useTheme } from './ThemeProvider';

export const MOOD_LABELS = ['Heavy', 'Low', 'Okay', 'Good', 'Bright'] as const;

/** The same five faces as Today's mood check-in. */
export function MoodFace({ mood, color, size = kit.moodFace }: { mood: number; color: string; size?: number }) {
  const edge = 18 - (mood - 3);
  const control = 18 + (mood - 3) * 3;
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <Circle cx="10" cy="11" r="1.8" fill={color} />
      <Circle cx="20" cy="11" r="1.8" fill={color} />
      <Path d={`M9 ${edge} Q15 ${control} 21 ${edge}`} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** Five faces in a row; the chosen one inverts to the accent. Selection tick, as on Today (spec 7.5). */
export function MoodPicker({ value, onChange }: { value: number | null; onChange: (mood: number) => void }) {
  const { palette } = useTheme();
  const fill = useFill();
  return (
    <View style={styles.block}>
      <View style={styles.row} accessibilityRole="radiogroup">
        {MOOD_LABELS.map((label, i) => {
          const mood = i + 1;
          const on = value === mood;
          return (
            <PressScale
              key={label}
              onPress={() => {
                haptics.selection();
                onChange(mood);
              }}
              accessibilityRole="radio"
              accessibilityLabel={label}
              testID={testId('mood', label)}
              accessibilityState={{ selected: on }}
              style={[styles.face, { backgroundColor: on ? palette.accent : fill }]}
            >
              <MoodFace mood={mood} color={on ? palette.onAccent : palette.ink} />
            </PressScale>
          );
        })}
      </View>
      <Text variant="footnote" tone="muted" center>
        {value ? MOOD_LABELS[value - 1] : ' '}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm, alignSelf: 'stretch' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  face: { width: kit.moodButton, height: kit.moodButton, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
