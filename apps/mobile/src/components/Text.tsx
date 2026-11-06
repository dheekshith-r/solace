import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { font, fontSize, lineHeightRatio, titleTracking, type Palette } from '../theme/tokens';
import { useTheme } from './ThemeProvider';

export type TextVariant = keyof typeof variants;
export type TextTone = 'ink' | 'muted' | 'accent' | 'onAccent' | 'destructive';

const title = (size: number) => ({
  fontFamily: font.bold,
  fontSize: size,
  lineHeight: Math.round(size * lineHeightRatio.title),
  letterSpacing: size * titleTracking,
});
const body = (size: number, family: string = font.regular) => ({
  fontFamily: family,
  fontSize: size,
  lineHeight: Math.round(size * lineHeightRatio.body),
});

const variants = StyleSheet.create({
  largeTitle: title(fontSize.largeTitle),
  title: title(fontSize.title),
  heading: { ...title(fontSize.heading), fontFamily: font.semibold },
  body: body(fontSize.body),
  bodyStrong: body(fontSize.body, font.semibold),
  callout: body(fontSize.callout),
  calloutStrong: body(fontSize.callout, font.semibold),
  footnote: body(fontSize.footnote),
  footnoteStrong: body(fontSize.footnote, font.semibold),
  caption: body(fontSize.caption),
});

const toneColor = (palette: Palette, tone: TextTone) => palette[tone];

/** All text in the app. One family, three weights, the spec 7.2 scale. Scales with the system font size. */
export function Text({
  variant = 'body',
  tone = 'ink',
  center,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; tone?: TextTone; center?: boolean }) {
  const { palette } = useTheme();
  return (
    <RNText
      {...rest}
      style={[variants[variant], { color: toneColor(palette, tone) }, center ? styles.center : null, style]}
    />
  );
}

const styles = StyleSheet.create({ center: { textAlign: 'center' } });
