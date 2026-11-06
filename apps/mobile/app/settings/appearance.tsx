// Appearance (spec 7.2): Sky (default), Follow system, Always light, Always dark. Today always follows its sky.
import { Check } from 'lucide-react-native';
import { Entrance, ListGroup, ListRow, Screen, Text } from '../../src/components';
import { APPEARANCES, useAppearance } from '../../src/features/appearance';
import { haptics } from '../../src/theme/haptics';

export default function AppearanceScreen() {
  const { appearance, setAppearance } = useAppearance();
  return (
    <Screen title="Appearance" back>
      <Entrance index={0}>
        <ListGroup>
          {APPEARANCES.map((a) => (
            <ListRow
              key={a.value}
              icon={appearance === a.value ? Check : undefined}
              title={a.label}
              subtitle={a.detail}
              trailing={{ kind: 'none' }}
              onPress={() => {
                haptics.selection();
                setAppearance(a.value);
              }}
            />
          ))}
        </ListGroup>
      </Entrance>
      <Entrance index={1}>
        <Text variant="footnote" tone="muted">
          Today always follows the sky outside, whatever you choose here.
        </Text>
      </Entrance>
    </Screen>
  );
}
