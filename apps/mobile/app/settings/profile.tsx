// Profile: the name Sola uses for you. Name only, by design (Ddk, Nov 7).
import { updateMeResponseSchema } from '@solace/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Screen, TextField, useToast } from '../../src/components';
import { authed, useSession } from '../../src/features/auth/session';
import { TODAY_KEY } from '../../src/features/today/data';
import { ApiError, OFFLINE_MESSAGE } from '../../src/lib/http';
import { queryClient } from '../../src/lib/queryClient';
import { spacing } from '../../src/theme/tokens';

export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const current = useSession((s) => s.user?.name ?? '');
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const trimmed = name.trim();

  const save = async () => {
    if (!trimmed) {
      setError('Tell Sola what to call you.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const res = await authed('/me', { method: 'PATCH', body: { name: trimmed }, schema: updateMeResponseSchema });
      useSession.setState({ user: res.user });
      // The server cleared today's greeting; refetch so Sola uses the new name.
      void queryClient.invalidateQueries({ queryKey: TODAY_KEY });
      toast.show('Saved.');
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Your name" back keyboard>
      <View style={styles.form}>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="What should Sola call you?" autoComplete="name" textContentType="name" returnKeyType="done" onSubmitEditing={() => void save()} error={error} maxLength={60} />
        <Button label="Save" onPress={() => void save()} loading={saving} disabled={trimmed === current.trim()} wide />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
});
