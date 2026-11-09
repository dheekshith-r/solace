import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { header } from '../theme/motion';
import { kit, screenPadding, spacing, tabBarHeight } from '../theme/tokens';
import { PressScale } from './PressScale';
import { BACK_ID, ROOT_ID, testId } from './testId';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

type Action = { icon: LucideIcon; label: string; onPress: () => void };

/**
 * The large title collapses into the bar as the page scrolls. The big title slides up and fades;
 * the bar's title and hairline fade in. Only transform and opacity animate.
 */
/** Who the screen is with: shown in the bar at all times instead of a title that fades in (the chat). */
export type HeaderIdentity = { avatar: ReactNode; title: string; subtitle: string };

export function Header({
  title,
  scrollY,
  back,
  action,
  identity,
  clear = false,
}: {
  title: string;
  scrollY: SharedValue<number>;
  back?: boolean;
  action?: Action;
  identity?: HeaderIdentity;
  /** Over a backdrop (the chat's sky): the bar never fills in, so the backdrop shows through. */
  clear?: boolean;
}) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const barTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [kit.headerCollapse * header.barTitleFrom, kit.headerCollapse], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.get(), [kit.headerCollapse * header.barTitleFrom, kit.headerCollapse], [spacing.xs, 0], Extrapolation.CLAMP) },
    ],
  }));
  // With an identity the bar's content is always there, so it turns solid as soon as anything scrolls under it.
  const fillBy = identity ? spacing.lg : kit.headerCollapse;
  const barFill = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, fillBy], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: insets.top + kit.headerBar }]} pointerEvents="box-none">
      {clear ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.background }, barFill]}>
          <View style={[styles.hairline, { backgroundColor: palette.separator }]} />
        </Animated.View>
      )}
      <View style={styles.barRow} pointerEvents="box-none">
        <View style={styles.side}>
          {back ? (
            <PressScale
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              testID={BACK_ID}
              hitSlop={spacing.sm}
              style={styles.iconButton}
            >
              <ChevronLeft size={kit.icon + spacing.xs} color={palette.accent} strokeWidth={kit.iconStrokeBold} />
            </PressScale>
          ) : null}
        </View>
        {identity ? (
          <View style={[styles.barTitle, styles.identity]} accessible accessibilityRole="header" accessibilityLabel={`${identity.title}. ${identity.subtitle}`}>
            {identity.avatar}
            <View>
              <Text variant="bodyStrong" numberOfLines={1}>
                {identity.title}
              </Text>
              <Text variant="footnote" tone="muted" numberOfLines={1}>
                {identity.subtitle}
              </Text>
            </View>
          </View>
        ) : (
          <Animated.View style={[styles.barTitle, barTitle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Text variant="bodyStrong" numberOfLines={1}>
              {title}
            </Text>
          </Animated.View>
        )}
        <View style={[styles.side, styles.sideEnd]}>
          {action ? (
            <PressScale
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              testID={testId('action', action.label)}
              hitSlop={spacing.sm}
              style={styles.iconButton}
            >
              <action.icon size={kit.icon} color={palette.accent} strokeWidth={kit.iconStrokeBold} />
            </PressScale>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function LargeTitle({ title, scrollY }: { title: string; scrollY: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      opacity: interpolate(y, [0, kit.headerCollapse * header.largeTitleGone], [1, 0], Extrapolation.CLAMP),
      // Pulling down past the top grows the title a little, like iOS.
      transform: [{ scale: interpolate(y, [-kit.headerCollapse * 2, 0], [header.pullGrow, 1], Extrapolation.CLAMP) }],
    };
  });
  return (
    <Animated.View style={[styles.largeTitle, style]}>
      <Text variant="largeTitle" accessibilityRole="header">
        {title}
      </Text>
    </Animated.View>
  );
}

/**
 * Every screen's frame: background, safe areas, status bar, and an optional large title that
 * collapses on scroll. `keyboard` keeps the focused field above the keyboard. `tabs` leaves room
 * for the floating tab bar.
 */
export function Screen({
  title,
  back = false,
  action,
  keyboard = false,
  tabs = false,
  scroll = true,
  children,
}: {
  title?: string;
  back?: boolean;
  action?: Action;
  keyboard?: boolean;
  tabs?: boolean;
  scroll?: boolean;
  children: ReactNode;
}) {
  const { palette, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  // Tab screens stay mounted, so the status bar is set whenever this screen gains focus.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  const top = insets.top + kit.headerBar;
  const bottom = insets.bottom + spacing.xxxl + (tabs ? tabBarHeight + spacing.lg : 0);
  const content = (
    <>
      {title ? <LargeTitle title={title} scrollY={scrollY} /> : null}
      <View style={styles.body}>{children}</View>
    </>
  );
  const contentStyle = { paddingTop: top, paddingBottom: bottom, paddingHorizontal: screenPadding };

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]} testID={ROOT_ID} collapsable={false}>
      {!scroll ? (
        <View style={[styles.screen, contentStyle]}>{content}</View>
      ) : keyboard ? (
        // Built on Reanimated's ScrollView, so the animated scroll handler works here too.
        <KeyboardAwareScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          bottomOffset={spacing.xxl}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={contentStyle}
        >
          {content}
        </KeyboardAwareScrollView>
      ) : (
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
          {content}
        </Animated.ScrollView>
      )}
      {title || back || action ? <Header title={title ?? ''} scrollY={scrollY} back={back} action={action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  barRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  side: { width: kit.rowMinHeight, alignItems: 'flex-start' },
  sideEnd: { alignItems: 'flex-end' },
  barTitle: { flex: 1, alignItems: 'center' },
  identity: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  iconButton: { width: kit.rowMinHeight - spacing.sm, height: kit.rowMinHeight - spacing.sm, alignItems: 'center', justifyContent: 'center' },
  largeTitle: { paddingBottom: spacing.lg, transformOrigin: 'left' },
  body: { gap: spacing.xxl },
});
