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

export const radius = { sheet: 32, card: 22, button: 18, chip: 16, full: 999 } as const;

export const today = {
  moodButton: 54,
  moodFace: 30,
  moodFillFrom: 0.82,
  moodLabelHeight: 18,
  ring: 56,
  ringStroke: 6,
  sheetHandleWidth: 36,
  sheetHandleHeight: 4,
  sheetDragThreshold: 0.3,
  sheetOverlap: 36,
} as const;

export const touchTarget = 44;
export const tabBarHeight = 58;
