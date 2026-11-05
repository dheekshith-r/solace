import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { pressScale, spring } from '../../theme/motion';
import { moodLabels, moodLevels } from '../../theme/sky';
import { font, fontSize, radius, spacing, tabBarHeight, today, type Palette } from '../../theme/tokens';

const MOODS = Array.from({ length: moodLevels }, (_, i) => i + 1);

function MoodFace({ mood, color }: { mood: number; color: string }) {
  const edge = 18 - (mood - 3);
  const control = 18 + (mood - 3) * 3;
  return (
    <Svg width={today.moodFace} height={today.moodFace} viewBox="0 0 30 30">
      <Circle cx="10" cy="11" r="1.8" fill={color} />
      <Circle cx="20" cy="11" r="1.8" fill={color} />
      <Path d={`M9 ${edge} Q15 ${control} 21 ${edge}`} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function MoodButton({ mood, selected, palette, onSelect }: {
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
}

function MoodLabel({ mood, selected, palette }: { mood: number; selected: boolean; palette: Palette }) {
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
}

export function MoodRow({ mood, palette, onSelect }: { mood: number; palette: Palette; onSelect: (mood: number) => void }) {
  return (
    <View style={styles.moodBlock}>
      <View style={styles.moodRow}>
        {MOODS.map((value) => (
          <MoodButton key={value} mood={value} selected={value === mood} palette={palette} onSelect={onSelect} />
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

export function Ring({ palette, progress, label }: { palette: Palette; progress: number; label: string }) {
  const r = (today.ring - today.ringStroke) / 2;
  const circumference = 2 * Math.PI * r;
  const c = today.ring / 2;
  return (
    <View style={styles.ring}>
      <Svg width={today.ring} height={today.ring}>
        <Circle cx={c} cy={c} r={r} stroke={palette.surface} strokeWidth={today.ringStroke} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={palette.accent}
          strokeWidth={today.ringStroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * progress} ${circumference}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <Text style={[styles.ringLabel, { color: palette.ink }]}>{label}</Text>
    </View>
  );
}

const TABS = ['Today', 'Sola', 'You'] as const;

export function TabBar({ palette, bottom }: { palette: Palette; bottom: number }) {
  return (
    <View style={[styles.tabBar, { backgroundColor: palette.tint, bottom, shadowColor: palette.ink }]}>
      {TABS.map((tab, index) => (
        <View key={tab} style={[styles.tab, index === 0 ? { backgroundColor: palette.accent } : undefined]}>
          <Text style={[styles.tabText, { color: index === 0 ? palette.onAccent : palette.muted }]}>{tab}</Text>
        </View>
      ))}
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
  ring: { width: today.ring, height: today.ring, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', fontFamily: font.bold, fontSize: fontSize.callout },
  tabBar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    height: tabBarHeight,
    padding: spacing.xs + spacing.xs / 2,
    gap: spacing.xs,
    borderRadius: radius.full,
    elevation: 10,
    shadowOpacity: 0.18,
    shadowRadius: spacing.lg,
    shadowOffset: { width: 0, height: spacing.sm },
  },
  tab: { paddingHorizontal: spacing.xxl, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: font.semibold, fontSize: fontSize.callout },
});
