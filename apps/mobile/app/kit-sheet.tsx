// Preview of the Sheet component, opened from the kit page. Not part of the product.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, Sheet, Text, ThemeProvider } from '../src/components';
import { spacing } from '../src/theme/tokens';

export default function KitSheet() {
  const { scheme } = useLocalSearchParams<{ scheme?: string }>();
  const router = useRouter();
  return (
    <ThemeProvider scheme={scheme === 'dark' ? 'dark' : 'light'}>
      <Sheet title="Save this feeling?">
        <Text variant="callout" tone="muted">
          Sheets rise over the page for one focused choice, then get out of the way.
        </Text>
        <View style={styles.actions}>
          <Button label="Save" onPress={() => router.back()} wide />
          <Button label="Not now" variant="text" onPress={() => router.back()} />
        </View>
      </Sheet>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ actions: { gap: spacing.sm, alignItems: 'center' } }); // Wide buttons still stretch.
