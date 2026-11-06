// Draws Sola large on the splash background, so the native splash image can be captured from the
// app's own art (solace://kit-sola?scheme=dark). Not part of the product.
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SolaFigure } from '../src/features/sola/Sola';
import { colors, kit } from '../src/theme/tokens';


export default function KitSola() {
  const { scheme } = useLocalSearchParams<{ scheme?: string }>();
  const dark = scheme === 'dark';
  return (
    <View style={[styles.screen, { backgroundColor: dark ? colors.dark.background : colors.light.background }]}>
      <SolaFigure size={kit.heroSola} glow={dark ? 'night' : 'day'} mood={4} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
