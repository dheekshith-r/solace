// Reminders (spec 8.10): what Sola reminds you of, and when. Changes reschedule everything at once.
import type { Reminders } from '@solace/shared';
import { Bell, BellOff, Plus, Send, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Card, EmptyState, Entrance, ListGroup, ListRow, Screen, Text, TextField, TimeStepper, useToast } from '../../src/components';
import { askForNotifications, notificationsAllowed, saveReminders, sendTestNotification, syncReminders, useReminders } from '../../src/features/notifications/reminders';
import { REMINDER_TITLES, type ReminderKindName } from '../../src/features/notifications/titles';
import { spacing } from '../../src/theme/tokens';

type Kind = ReminderKindName;
const KINDS = REMINDER_TITLES;

export default function RemindersScreen() {
  const toast = useToast();
  const reminders = useReminders((s) => s.reminders);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    void notificationsAllowed().then(setAllowed);
    void syncReminders();
  }, []);

  const update = (next: Reminders) => void saveReminders(next);
  const setKind = (kind: Kind, patch: Partial<Reminders[Kind]>) => update({ ...reminders, [kind]: { ...reminders[kind], ...patch } });

  const addCustom = () => {
    const label = newLabel.trim();
    if (!label) return;
    const id = `${Date.now().toString(36)}`;
    update({ ...reminders, custom: [...reminders.custom, { id, label, time: '18:00', on: true }] });
    setNewLabel('');
    setEditing(`custom-${id}`);
  };

  return (
    <Screen title="Reminders" back keyboard>
      {allowed === false ? (
        <Entrance index={0}>
          <Card>
            <EmptyState
              icon={BellOff}
              title="Notifications are off"
              body="Sola can't remind you until notifications are allowed for Solace."
              action={{
                label: 'Allow notifications',
                onPress: async () => {
                  const granted = await askForNotifications();
                  setAllowed(granted);
                  if (granted) await saveReminders(reminders);
                  else void Linking.openSettings();
                },
              }}
            />
          </Card>
        </Entrance>
      ) : null}

      <Entrance index={1}>
        <ListGroup header="From Sola">
          {KINDS.flatMap(({ kind, title, icon }) => {
            const r = reminders[kind];
            const rows = [
              <ListRow key={kind} icon={icon} title={title} subtitle={r.on ? `Every day at ${r.time}` : 'Off'} trailing={{ kind: 'switch', on: r.on, onChange: (on) => setKind(kind, { on }) }} />,
            ];
            if (r.on) {
              rows.push(
                editing === kind ? (
                  <View key={`${kind}-time`} style={styles.editor}>
                    <TimeStepper label={title} value={r.time} onChange={(time) => setKind(kind, { time })} />
                    <Button label="Done" variant="text" align="center" onPress={() => setEditing(null)} />
                  </View>
                ) : (
                  <ListRow key={`${kind}-time`} title="Time" trailing={{ kind: 'value', value: r.time }} onPress={() => setEditing(kind)} />
                ),
              );
            }
            return rows;
          })}
        </ListGroup>
      </Entrance>

      <Entrance index={2}>
        <ListGroup header="Your own">
          {[
            ...reminders.custom.flatMap((c) => [
              <ListRow
                key={c.id}
                icon={Bell}
                title={c.label}
                subtitle={c.on ? `Every day at ${c.time}` : 'Off'}
                trailing={{ kind: 'switch', on: c.on, onChange: (on) => update({ ...reminders, custom: reminders.custom.map((x) => (x.id === c.id ? { ...x, on } : x)) }) }}
              />,
              editing === `custom-${c.id}` ? (
                <View key={`${c.id}-time`} style={styles.editor}>
                  <TimeStepper label={c.label} value={c.time} onChange={(time) => update({ ...reminders, custom: reminders.custom.map((x) => (x.id === c.id ? { ...x, time } : x)) })} />
                  <View style={styles.actions}>
                    <Button label="Delete" variant="text" icon={Trash2} onPress={() => update({ ...reminders, custom: reminders.custom.filter((x) => x.id !== c.id) })} />
                    <Button label="Done" variant="text" onPress={() => setEditing(null)} />
                  </View>
                </View>
              ) : (
                <ListRow key={`${c.id}-time`} title="Time" trailing={{ kind: 'value', value: c.time }} onPress={() => setEditing(`custom-${c.id}`)} />
              ),
            ]),
            <View key="add" style={styles.editor}>
              <TextField label="New reminder" value={newLabel} onChangeText={setNewLabel} placeholder="Drink some water" maxLength={60} returnKeyType="done" onSubmitEditing={addCustom} />
              <Button label="Add reminder" variant="secondary" icon={Plus} onPress={addCustom} disabled={!newLabel.trim()} />
            </View>,
          ]}
        </ListGroup>
      </Entrance>

      <Entrance index={3} style={styles.footer}>
        <Button
          label="Send a test notification"
          variant="secondary"
          icon={Send}
          onPress={async () => {
            if (!(await notificationsAllowed()) && !(await askForNotifications())) return;
            await sendTestNotification();
            toast.show('Sent. It should arrive in a moment.');
          }}
        />
        <Text variant="footnote" tone="muted">
          On Xiaomi, Redmi and Poco phones, reminders can be delayed by battery saving. If they arrive late, set Solace to &quot;No restrictions&quot; in Settings, Apps, Solace, Battery saver.
        </Text>
      </Entrance>
    </Screen>
  );
}

const styles = StyleSheet.create({
  editor: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: { gap: spacing.md },
});
