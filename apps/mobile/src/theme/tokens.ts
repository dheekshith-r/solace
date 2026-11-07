// Design tokens from spec section 7.2: Apple HIG system colors. Components never hardcode values.

export const colors = {
  light: {
    background: '#F2F2F7',
    surface: '#FFFFFF',
    tint: '#F2F2F7',
    ink: '#000000',
    muted: '#6C6C70',
    separator: '#D1D1D6',
    accent: '#1E6EF4',
    onAccent: '#FFFFFF',
    destructive: '#FF383C', // HIG system red (2025). Destructive actions only (Ddk, Nov 6).
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    tint: '#2C2C2E',
    ink: '#FFFFFF',
    muted: '#AEAEB2',
    separator: '#3A3A3C',
    accent: '#5CB8FF',
    onAccent: '#000000',
    destructive: '#FF4245', // HIG system red, dark (2025).
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type Palette = (typeof colors)[ColorScheme];

export const fontSize = {
  largeTitle: 34,
  title: 26,
  heading: 20,
  body: 17,
  callout: 15,
  footnote: 13,
  caption: 11.5,
} as const;

export const lineHeightRatio = { title: 1.28, body: 1.42 } as const;
export const titleTracking = -0.02;

export const font = {
  regular: 'PlusJakartaSans_400Regular',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;

export const screenPadding = 22;

// Hero cards use the petal shape: hero on three corners, petal on one.
export const radius = { sheet: 32, hero: 34, card: 22, button: 18, chip: 16, field: 14, petal: 12, full: 999 } as const;

// Component sizes for the kit (src/components). Built on the 4/8 grid.
export const kit = {
  buttonHeight: 52,
  chipHeight: 36,
  fieldHeight: 52,
  rowMinHeight: 52,
  icon: 22,
  iconSmall: 18,
  emptyIcon: 64,
  headerBar: 52, // Collapsed header, below the status bar.
  headerCollapse: 44, // Scroll distance over which the large title hands off to the bar title.
  grabberWidth: 36,
  grabberHeight: 5,
  iconWell: 34, // The soft square behind a list row's icon.
  iconStroke: 2,
  iconStrokeBold: 2.2,
  iconStrokeLight: 1.8,
  elevation: 10, // Tab bar only (spec 7.2: only the tab bar and floating sheets get elevation).
  toastTop: 8,
  focusBorder: 2,
  dashWidth: 28, // Onboarding progress segments.
  dashHeight: 4,
  heroSola: 132, // Sola on onboarding and splash.
  checkbox: 24,
  messageMax: 2000, // Same limit as the API.
  composerMax: 140, // The message box grows to about five lines, then scrolls.
  sendDisabled: 0.4,
  solaInline: 56, // Small Sola beside the daily line and in conversations.
  solaAvatar: 30, // Sola in the conversation header, beside "Here, no rush".
  orb: 260, // The breathing orb at full size.
  star: 4,
  starGlow: 10,
  starQuiet: 2,
  starRow: 34,
  trendHeight: 120,
  orbSmall: 0.55, // Its size after breathing out.
  moodButton: 54,
  moodFace: 30,
  checkFrom: 0.6, // The checkbox fill grows from 60%.
  pageMaxText: 340, // Readable line length for centered page copy.
  shadowOpacity: 0.18,
} as const;

// Row separators start where the row's title starts: row padding, icon well, gap.
export const separatorInset = spacing.lg + kit.iconWell + spacing.md;

export const opacity = { disabled: 0.4, skeletonLow: 0.45, skeletonHigh: 0.9 } as const;

// Charts on the You tab: soft lines that fade at the ends (design/NOTES.md).
export const chart = { joinOpacity: 0.35, joinWidth: 1.5, glowOpacity: 0.18, quietOpacity: 0.4, lineWidth: 3, fadeEdge: 0.15, fadeEnd: 0.35 } as const;

// Text in fixed-height chrome (the tab bar) stops growing at 1.3x, so it never clips.
export const type = { maxScale: 1.3 } as const;

export const today = {
  moodButton: 54,
  moodFace: 30,
  moodFillFrom: 0.82,
  moodLabelHeight: 18,
  sheetOverlap: 36,
} as const;

export const touchTarget = 44;
export const tabBarHeight = 58;
