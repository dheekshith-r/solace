// Design tokens from spec section 7.2. Phase 1 extends this file; components never hardcode values.

export const colors = {
  light: {
    background: '#EEF0F8',
    surface: '#FFFFFF',
    ink: '#25233A',
    muted: '#77758C',
    accent: '#6F63E8',
    accentTint: '#E3E0FB',
    petal: '#FFE1D8',
    sea: '#D8F1E8',
    mascot: '#B7ADFF',
  },
  dark: {
    background: '#12111C',
    surface: '#1C1B2B',
    ink: '#F0EEFA',
    muted: '#9C99B2',
    accent: '#A99DFF',
    accentTint: '#2A2746',
    petal: '#3B2A33',
    sea: '#1F3329',
    mascot: '#8D80F2',
  },
} as const;

export type ColorScheme = keyof typeof colors;

export const fontSize = {
  largeTitle: 34,
  title: 26,
  heading: 20,
  body: 17,
  callout: 15,
  footnote: 13,
  caption: 11.5,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;

export const screenPadding = 22;
