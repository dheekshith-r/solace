import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { ToastProvider, useToast } from '../Toast';
import { colors } from '../../theme/tokens';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success' },
}));

describe('Button', () => {
  it('calls onPress once per press', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while loading or disabled', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button label="Save" loading onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await rerender(<Button label="Save" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('shows its error message', async () => {
    await render(<TextField label="Email" error="Enter an email address." />);
    expect(screen.getByText('Enter an email address.')).toBeTruthy();
  });

  it('toggles password visibility', async () => {
    await render(<TextField label="Password" secure />);
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
  });
});

describe('useTheme', () => {
  function Probe() {
    const { palette, scheme } = useTheme();
    return <RNText>{`${scheme} ${palette.background}`}</RNText>;
  }

  it('returns the dark palette when overridden', async () => {
    await render(
      <ThemeProvider scheme="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText(`dark ${colors.dark.background}`)).toBeTruthy();
  });
});

describe('Toast', () => {
  function Trigger({ message }: { message: string }) {
    const toast = useToast();
    return <Button label={`Show ${message}`} variant="secondary" onPress={() => toast.show(message)} />;
  }

  it('shows one message at a time and replaces the previous one', async () => {
    await render(
      <ToastProvider>
        <Trigger message="First" />
        <Trigger message="Second" />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Show First' }));
    expect(screen.getByText('First')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Show Second' }));
    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('starts hiding after its duration', async () => {
    jest.useFakeTimers();
    await render(
      <ToastProvider hideAfter={1000}>
        <Trigger message="Saved" />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Show Saved' }));
    expect(screen.getByText('Saved')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Saved')).toBeNull();
    jest.useRealTimers();
  });
});

describe('TabBar', () => {
  it('places the lit pill one tab width plus a gap per tab', () => {
    const { pillOffset } = jest.requireActual('../TabBar') as typeof import('../TabBar');
    const { kit, spacing } = jest.requireActual('../../theme/tokens') as typeof import('../../theme/tokens');
    expect(pillOffset(0)).toBe(0);
    expect(pillOffset(1)).toBe(kit.tabWidth + spacing.xs);
    expect(pillOffset(2)).toBe(2 * (kit.tabWidth + spacing.xs));
  });
});
