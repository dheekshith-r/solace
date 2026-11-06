// The component kit on one page, light and dark, for review on the phone (solace://kit).
// Not part of the product; every screen builds only from what's shown here.
import { useRouter } from 'expo-router';
import { Bell, CloudOff, Moon, MessageCircle, RotateCcw, Shield, Sparkles, Trash2, Wind } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Entrance,
  ListGroup,
  ListRow,
  Screen,
  SkeletonCard,
  SkeletonRow,
  Text,
  TextField,
  ThemeProvider,
  ToastProvider,
  useTheme,
  useToast,
} from '../src/components';
import type { ColorScheme } from '../src/theme/tokens';
import { spacing } from '../src/theme/tokens';

function Section({ title, index, children }: { title: string; index: number; children: React.ReactNode }) {
  return (
    <Entrance index={index} style={styles.section}>
      <Text variant="footnoteStrong" tone="muted" accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {children}
    </Entrance>
  );
}

function KitContent({ scheme, setScheme }: { scheme: ColorScheme; setScheme: (scheme: ColorScheme) => void }) {
  const router = useRouter();
  const toast = useToast();
  const { palette } = useTheme();
  const [goal, setGoal] = useState('Calm');
  const [reminders, setReminders] = useState(true);
  const [email, setEmail] = useState('');
  const [replay, setReplay] = useState(0);
  const emailError = email.length > 0 && !email.includes('@') ? 'Enter an email address like name@example.com.' : undefined;

  return (
    <Screen title="Kit" back action={{ icon: RotateCcw, label: 'Replay entrance', onPress: () => setReplay(replay + 1) }} keyboard>
      <View key={replay} style={styles.sections}>
        <Section title="Appearance" index={0}>
          <View style={styles.wrap}>
            <Chip label="Light" selected={scheme === 'light'} onPress={() => setScheme('light')} />
            <Chip label="Dark" selected={scheme === 'dark'} onPress={() => setScheme('dark')} />
          </View>
        </Section>

        <Section title="Type" index={1}>
          <Text variant="title">A calm place to land</Text>
          <Text variant="heading">How are you arriving?</Text>
          <Text variant="body">Sola reflects what you actually said, then offers one small next step.</Text>
          <Text variant="callout" tone="muted">
            Callout, muted. Secondary details stay quiet.
          </Text>
          <Text variant="footnote" tone="muted">
            Footnote. Not a substitute for professional help.
          </Text>
        </Section>

        <Section title="Buttons" index={2}>
          <Button label="Start breathing" icon={Wind} onPress={() => toast.show('Primary pressed')} wide />
          <View style={styles.wrap}>
            <Button label="Secondary" variant="secondary" onPress={() => toast.show('Secondary pressed')} />
            <Button label="Text button" variant="text" onPress={() => toast.show('Text pressed')} />
          </View>
          <View style={styles.wrap}>
            <Button label="Saving" loading onPress={() => undefined} />
            <Button label="Disabled" disabled onPress={() => undefined} />
          </View>
        </Section>

        <Section title="Chips" index={3}>
          <View style={styles.wrap}>
            {['Calm', 'Sleep', 'Focus', 'Confidence', 'Connection'].map((label) => (
              <Chip key={label} label={label} selected={goal === label} onPress={() => setGoal(label)} />
            ))}
          </View>
        </Section>

        <Section title="Cards" index={4}>
          <Card hero onPress={() => toast.show('Hero card')} accessibilityLabel="Reflect, three friendly check-ins">
            <Sparkles size={spacing.xxl} color={palette.accent} />
            <Text variant="heading">Reflect</Text>
            <Text variant="callout" tone="muted">
              Three friendly check-ins, not diagnoses.
            </Text>
          </Card>
          <Card>
            <Text variant="bodyStrong">A plain card</Text>
            <Text variant="callout" tone="muted">
              Surface on the background, radius 22.
            </Text>
          </Card>
          <Card>
            <Text variant="bodyStrong">A card inside a card</Text>
            <Card onPress={() => toast.show('Nested card')} accessibilityLabel="Nested and pressable">
              <Text variant="callout">Nested and pressable: tinted automatically.</Text>
            </Card>
            <View style={styles.wrap}>
              <Chip label="On a card" onPress={() => toast.show('Chip on a card')} />
              <Button label="Secondary" variant="secondary" onPress={() => toast.show('Secondary on a card')} />
            </View>
          </Card>
        </Section>

        <Section title="List rows" index={5}>
          <ListGroup header="Settings">
            <ListRow icon={Bell} title="Reminders" subtitle="Check-in at 9:00, breathe at 21:30" onPress={() => toast.show('Reminders')} />
            <ListRow icon={Moon} title="Appearance" trailing={{ kind: 'value', value: 'Sky' }} onPress={() => toast.show('Appearance')} />
            <ListRow icon={Shield} title="Personalize with my history" trailing={{ kind: 'switch', on: reminders, onChange: setReminders }} />
            <ListRow icon={Trash2} title="Delete all chats" destructive trailing={{ kind: 'none' }} onPress={() => toast.show('Asks to confirm first')} />
          </ListGroup>
        </Section>

        <Section title="Text fields" index={6}>
          <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" error={emailError} />
          <TextField label="Password" secure placeholder="At least 8 characters" helper="Use 8 or more characters." />
        </Section>

        <Section title="Sheet and toast" index={7}>
          <View style={styles.wrap}>
            <Button label="Open sheet" variant="secondary" onPress={() => router.push({ pathname: '/kit-sheet', params: { scheme } })} />
            <Button label="Show toast" variant="secondary" onPress={() => toast.show('Saved. Sola noticed.')} />
          </View>
        </Section>

        <Section title="Loading" index={8}>
          <SkeletonCard />
          <Card style={styles.flush}>
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        </Section>

        <Section title="Empty and error" index={9}>
          <Card>
            <EmptyState
              icon={MessageCircle}
              title="Nothing here yet"
              body="Tell Sola what's on your mind, and your conversations will live here."
              action={{ label: 'New conversation', onPress: () => toast.show('New conversation') }}
            />
          </Card>
          <Card>
            <EmptyState
              icon={CloudOff}
              title="Couldn't reach Solace"
              body="Check your connection. We'll keep trying quietly."
              action={{ label: 'Try again', variant: 'secondary', onPress: () => toast.show('Retrying') }}
            />
          </Card>
        </Section>
      </View>
    </Screen>
  );
}

export default function Kit() {
  const [scheme, setScheme] = useState<ColorScheme>('light');
  return (
    <ThemeProvider scheme={scheme}>
      <ToastProvider>
        <KitContent scheme={scheme} setScheme={setScheme} />
      </ToastProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing.xxxl },
  section: { gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  flush: { padding: 0 },
});
