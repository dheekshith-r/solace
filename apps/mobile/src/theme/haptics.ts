// The haptics map (spec section 7.5). Nothing else in the app calls expo-haptics directly.
import * as Haptics from 'expo-haptics';

export const haptics = {
  /** Mood choice, tab change, chips. */
  selection: () => void Haptics.selectionAsync(),
  /** Primary buttons. */
  light: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Each breathing phase change. */
  soft: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
  /** End of a breathing session or a check-in. */
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
} as const;
