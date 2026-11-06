// Resources (spec 8.11): five short guides, and getting help now.
import { useRouter } from 'expo-router';
import { BookOpen, CloudOff, LifeBuoy } from 'lucide-react-native';
import { Card, EmptyState, Entrance, ListGroup, ListRow, Screen, SkeletonCard, Text } from '../../src/components';
import { useResources } from '../../src/features/resources/data';

export default function ResourcesScreen() {
  const router = useRouter();
  const resources = useResources();
  const guides = resources.data?.guides ?? [];
  return (
    <Screen title="Resources" back>
      <Entrance index={0}>
        <ListGroup>
          <ListRow icon={LifeBuoy} title="Get help now" subtitle="Tele-MANAS 14416, free and 24 hours" onPress={() => router.push({ pathname: '/resources/[slug]', params: { slug: 'help' } })} />
        </ListGroup>
      </Entrance>
      <Entrance index={1}>
        {resources.isPending ? (
          <SkeletonCard lines={4} />
        ) : !guides.length ? (
          <Card>
            <EmptyState icon={CloudOff} title="Couldn't load the guides" body="Check your connection and try again. Get help now always works." action={{ label: 'Try again', variant: 'secondary', onPress: () => void resources.refetch() }} />
          </Card>
        ) : (
          <ListGroup header="Short guides">
            {guides.map((g) => (
              <ListRow key={g.slug} icon={BookOpen} title={g.title} subtitle={`${g.summary} · ${g.minutes} min`} onPress={() => router.push({ pathname: '/resources/[slug]', params: { slug: g.slug } })} />
            ))}
          </ListGroup>
        )}
      </Entrance>
      <Text variant="footnote" tone="muted">
        Solace is not a substitute for professional care.
      </Text>
    </Screen>
  );
}
