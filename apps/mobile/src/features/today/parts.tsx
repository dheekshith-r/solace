import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { pressScale, spring } from '../../theme/motion';
import { moodLabels, moodLevels } from '../../theme/sky';
import { font, fontSize, radius, spacing, today, type Palette } from '../../theme/tokens';
import { testId } from '../../components/testId';

const MOODS = Array.from({ length: moodLevels }, (_, i) => i + 1);

const MoodFace = memo(function MoodFace({ mood, color }: { mood: number; color: string }) {
  const edge = 18 - (mood - 3);
  const control = 18 + (mood - 3) * 3;
  return (
    <Svg width={today.moodFace} height={today.moodFace} viewBox="0 0 30 30">
      <Circle cx="10" cy="11" r="1.8" fill={color} />
      <Circle cx="20" cy="11" r="1.8" fill={color} />
      <Path d={`M9 ${edge} Q15 ${control} 21 ${edge}`} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
});

const MoodButton = memo(function MoodButton({ mood, selected, palette, onSelect }: {
  mood: number;
  selected: boolean;
  palette: Palette;
  onSelect: (mood: number) => void;
}) {
  const scale = useSharedValue(1);
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(selected ? 1 : 0, spring));
  }, [on, selected]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  // The selected fill grows and fades in, and the two faces cross-fade. Nothing snaps.
  const fillStyle = useAnimatedStyle(() => ({
    opacity: on.get(),
    transform: [{ scale: today.moodFillFrom + (1 - today.moodFillFrom) * on.get() }],
  }));
  const offFace = useAnimatedStyle(() => ({ opacity: 1 - on.get() }));
  const onFace = useAnimatedStyle(() => ({ opacity: on.get() }));

  return (
    <Pressable
      onPressIn={() => {
        scale.set(withSpring(pressScale, spring));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, spring));
      }}
      onPress={() => {
        void Haptics.selectionAsync();
        onSelect(mood);
      }}
      accessibilityRole="button"
      accessibilityLabel={moodLabels[mood - 1]}
      testID={testId('mood', moodLabels[mood - 1] ?? String(mood))}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[styles.moodButton, { backgroundColor: palette.tint }, style]}>
        <Animated.View style={[styles.moodFill, { backgroundColor: palette.accent }, fillStyle]} />
        <Animated.View style={[styles.moodFaceLayer, offFace]}>
          <MoodFace mood={mood} color={palette.ink} />
        </Animated.View>
        <Animated.View style={[styles.moodFaceLayer, onFace]}>
          <MoodFace mood={mood} color={palette.onAccent} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

const MoodLabel = memo(function MoodLabel({ mood, selected, palette }: { mood: number; selected: boolean; palette: Palette }) {
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(selected ? 1 : 0, spring));
  }, [on, selected]);
  const style = useAnimatedStyle(() => ({ opacity: on.get() }));
  return (
    <Animated.Text
      style={[styles.moodLabel, styles.moodLabelLayer, { color: palette.muted }, style]}
      accessibilityElementsHidden={!selected}
      importantForAccessibility={selected ? 'yes' : 'no-hide-descendants'}
    >
      {moodLabels[mood - 1]}
    </Animated.Text>
  );
});

/** No mood chosen yet: nothing is selected until the first tap (Ddk, Nov 7). */
export const NO_MOOD = 0;

/**
 * Holds the selected mood itself, so a tap re-renders only the two buttons that change.
 * `logged` is a mood the user already logged today; it shows until they tap another.
 */
export function MoodRow({ level, palette, onSelect, logged = null }: { level: SharedValue<number>; palette: Palette; onSelect: (mood: number) => void; logged?: number | null }) {
  const [tapped, setMood] = useState<number | null>(() => level.get() || null);
  // A tap wins; until then, a mood logged today; otherwise nothing.
  const mood = tapped ?? logged;
  const pick = useCallback(
    (next: number) => {
      level.set(next);
      setMood(next);
      onSelect(next);
    },
    [level, onSelect],
  );
  return (
    <View style={styles.moodBlock}>
      <View style={styles.moodRow}>
        {MOODS.map((value) => (
          <MoodButton key={value} mood={value} selected={value === mood} palette={palette} onSelect={pick} />
        ))}
      </View>
      <View style={styles.moodLabelStack}>
        {MOODS.map((value) => (
          <MoodLabel key={value} mood={value} selected={value === mood} palette={palette} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  moodBlock: { gap: spacing.sm },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodButton: {
    width: today.moodButton,
    height: today.moodButton,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodFill: { ...StyleSheet.absoluteFill, borderRadius: radius.full },
  moodFaceLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  moodLabel: { fontFamily: font.regular, fontSize: fontSize.footnote, textAlign: 'center' },
  moodLabelStack: { height: today.moodLabelHeight },
  moodLabelLayer: { ...StyleSheet.absoluteFill },
});
