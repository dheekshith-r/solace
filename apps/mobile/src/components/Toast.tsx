import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { duration, easing, spring } from '../theme/motion';
import { kit, radius, screenPadding, spacing } from '../theme/tokens';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

type ToastApi = { show: (message: string) => void };

const ToastContext = createContext<ToastApi>({ show: () => undefined });

const HIDDEN_OFFSET = -spacing.xxxl;

/** One message at a time, inverted (ink on background) so it reads on any screen, announced to screen readers. */
export function ToastProvider({ children, hideAfter = duration.toast }: { children: ReactNode; hideAfter?: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shown = useSharedValue(0);

  const clear = useCallback(() => setMessage(null), []);
  const hide = useCallback(() => {
    shown.set(
      withTiming(0, { duration: duration.quick, easing }, (finished) => {
        if (finished) scheduleOnRN(clear);
      }),
    );
  }, [clear, shown]);

  const show = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      shown.set(withSpring(1, spring));
      AccessibilityInfo.announceForAccessibility(next);
      timer.current = setTimeout(hide, hideAfter);
    },
    [hide, hideAfter, shown],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {message ? <ToastView message={message} shown={shown} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ message, shown }: { message: string; shown: ReturnType<typeof useSharedValue<number>> }) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: HIDDEN_OFFSET * (1 - shown.get()) }],
  }));
  return (
    <View style={[styles.layer, { top: insets.top + kit.toastTop }]} pointerEvents="none">
      <Animated.View style={[styles.toast, { backgroundColor: palette.ink }, style]} accessibilityRole="alert">
        <Text variant="calloutStrong" style={{ color: palette.background }} center>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: screenPadding, right: screenPadding, alignItems: 'center' },
  toast: { borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
