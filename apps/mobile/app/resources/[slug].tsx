// A guide, or Get help now (slug "help"): readable long text under a large title.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Entrance, HelplineCard, Screen, SkeletonCard, Text } from '../../src/components';
import { OFFLINE_HELP, useResources } from '../../src/features/resources/data';

export default function GuideScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const resources = useResources();

  if (slug === 'help') {
    const help = resources.data?.getHelp ?? OFFLINE_HELP;
    return (
      <Screen title="Get help now" back>
        <Entrance index={0}>
          <Text variant="body">If you are struggling, you deserve support from a real person. These lines are free and confidential.</Text>
        </Entrance>
        <Entrance index={1}>
          <HelplineCard name={help.helpline.name} number={help.helpline.number} hours={help.helpline.hours} emergencyNumber={help.emergencyNumber} onTalkToSola={() => router.push('/sola/new')} />
        </Entrance>
        <Text variant="footnote" tone="muted">
          {help.note}
        </Text>
      </Screen>
    );
  }

  const guide = resources.data?.guides.find((g) => g.slug === slug);
  return (
    <Screen title={guide?.title ?? 'Guide'} back>
      {!guide ? (
        <SkeletonCard lines={6} />
      ) : (
        guide.sections.map((s, i) => (
          <Entrance key={s.heading} index={i}>
            <Text variant="heading" accessibilityRole="header">
              {s.heading}
            </Text>
            <Text variant="body">{s.body}</Text>
          </Entrance>
        ))
      )}
      <Text variant="footnote" tone="muted">
        Solace is not a substitute for professional care. If you are in danger, call 112.
      </Text>
    </Screen>
  );
}
