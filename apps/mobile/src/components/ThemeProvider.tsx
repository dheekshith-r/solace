import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, type ColorScheme, type Palette } from '../theme/tokens';

type Theme = { scheme: ColorScheme; palette: Palette };

const ThemeContext = createContext<Theme>({ scheme: 'light', palette: colors.light });

/** Light or dark for everything below. `scheme` overrides the system (the kit preview, and Appearance later). */
export function ThemeProvider({ scheme, children }: { scheme?: ColorScheme; children: ReactNode }) {
  const system = useColorScheme();
  const resolved: ColorScheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const value = useMemo(() => ({ scheme: resolved, palette: colors[resolved] }), [resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

// In light mode, `tint` and `background` are the same gray, so a fill must know what it sits on.
// Levels alternate: on the page (0) fills are `surface`; inside a card, sheet or list (1) they are
// `tint`; inside a card nested in that (2), `surface` again, and so on.
const LevelContext = createContext(0);

/** Wraps the content of anything that draws a fill (cards, sheets, list groups). */
export function Raised({ children }: { children: ReactNode }) {
  const level = useContext(LevelContext);
  return <LevelContext.Provider value={level + 1}>{children}</LevelContext.Provider>;
}

/** The fill for cards, secondary buttons, chips, fields, wells and skeletons, wherever they sit. */
export function useFill(): string {
  const { palette } = useTheme();
  return useContext(LevelContext) % 2 === 0 ? palette.surface : palette.tint;
}

/** The color under this content (page, card or nested well), for layers that must hide what's behind them. */
export function useBackdrop(): string {
  const { palette } = useTheme();
  const level = useContext(LevelContext);
  return level === 0 ? palette.background : level % 2 === 1 ? palette.surface : palette.tint;
}

/** True inside a card, sheet or grouped list. */
export function useIsRaised(): boolean {
  return useContext(LevelContext) % 2 === 1;
}