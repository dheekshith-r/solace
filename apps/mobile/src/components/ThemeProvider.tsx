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

// In light mode, `tint` and `background` are the same gray, so a fill must know what it sits on:
// on the page background it uses `surface`; on a card, sheet or grouped list it uses `tint`.
const RaisedContext = createContext(false);

/** Wraps the content of anything that draws a `surface` (cards, sheets, list groups). */
export function Raised({ children }: { children: ReactNode }) {
  return <RaisedContext.Provider value>{children}</RaisedContext.Provider>;
}

/** The fill for secondary buttons, chips, fields, wells and skeletons, wherever they sit. */
export function useFill(): string {
  const { palette } = useTheme();
  return useContext(RaisedContext) ? palette.tint : palette.surface;
}

/** True inside a card, sheet or grouped list. */
export function useIsRaised(): boolean {
  return useContext(RaisedContext);
}
