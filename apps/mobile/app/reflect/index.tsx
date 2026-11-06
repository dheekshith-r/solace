// Reflect hub (spec 8.8): three friendly check-ins, not diagnoses.
import { useRouter } from 'expo-router';
import { Brain, CloudRain, MessageCircleHeart } from 'lucide-react-native';
import { Card, Entrance, Screen, Text, useTheme } from '../../src/components';
import { CHECKINS, type ReflectKind } from '../../src/features/reflect/questions';
import { kit } from '../../src/theme/tokens';

const ICONS: Record<ReflectKind, typeof Brain> = { mood: CloudRain, anxiety: Brain, self_talk: MessageCircleHeart };

export default function ReflectHub() {
  const router = useRouter();
  const { palette } = useTheme();
  return (
    <Screen title="Reflect" back>
      <Entrance index={0}>
        <Text variant="callout" tone="muted">
          Three friendly check-ins, not diagnoses. Four questions each, about a minute. Sola asks one at a time.
        </Text>
      </Entrance>
      {(Object.keys(CHECKINS) as ReflectKind[]).map((kind, i) => {
        const Icon = ICONS[kind];
        return (
          <Entrance key={kind} index={i + 1}>
            <Card hero={i === 0} onPress={() => router.push({ pathname: '/reflect/[kind]', params: { kind } })} accessibilityLabel={`${CHECKINS[kind].title}. ${CHECKINS[kind].blurb}`}>
              <Icon size={kit.icon + kit.focusBorder} color={palette.accent} />
              <Text variant="heading">{CHECKINS[kind].title}</Text>
              <Text variant="callout" tone="muted">
                {CHECKINS[kind].blurb}
              </Text>
            </Card>
          </Entrance>
        );
      })}
      <Text variant="footnote" tone="muted">
        Not a substitute for professional help. If you are in danger, call 112. Tele-MANAS (14416) is free, 24 hours a day.
      </Text>
    </Screen>
  );
}
