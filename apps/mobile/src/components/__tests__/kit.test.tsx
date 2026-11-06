import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { ToastProvider, useToast } from '../Toast';
import { colors } from '../../theme/tokens';

// Screen's native dependencies, replaced for unit tests.
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }), useFocusEffect: jest.fn() }));
jest.mock('expo-status-bar', () => ({ setStatusBarStyle: jest.fn() }));
jest.mock('react-native-keyboard-controller', () => ({ KeyboardAwareScrollView: jest.requireActual('react-native').ScrollView }));

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
    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    expect(screen.getByText('Saved')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Saved')).toBeNull();
    jest.useRealTimers();
  });
});

describe('TabBar pill', () => {
  const { pillGeometry } = jest.requireActual('../TabBar') as typeof import('../TabBar');
  const slots = [
    { x: 6, width: 100 },
    { x: 110, width: 80 },
    { x: 194, width: 70 },
  ];

  it('sits exactly on a tab, and blends position and width between tabs', () => {
    expect(pillGeometry(1, slots)).toEqual({ x: 110, width: 80 });
    expect(pillGeometry(0.5, slots)).toEqual({ x: 58, width: 90 });
  });

  it('never overshoots past the first or last tab, even when the spring does', () => {
    expect(pillGeometry(-0.1, slots)).toEqual(slots[0]);
    expect(pillGeometry(2.1, slots)).toEqual(slots[2]);
  });
});

describe('Screen header', () => {
  it('shows the large title as a header, and draws a bar title that screen readers skip', async () => {
    const { Screen } = jest.requireActual('../Screen') as typeof import('../Screen');
    await render(
      <Screen title="Reminders">
        <RNText>Body</RNText>
      </Screen>,
    );
    expect(screen.getByRole('header', { name: 'Reminders' })).toBeTruthy();
    // Both titles are drawn, but screen readers hear only the large one, never twice.
    expect(screen.getAllByText('Reminders', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getAllByText('Reminders')).toHaveLength(1);
  });
});
describe('native splash colors', () => {
  it('match the HIG tokens, so the native splash hands off seamlessly', () => {
    const config = jest.requireActual('../../../app.config') as { SPLASH_LIGHT: string; SPLASH_DARK: string; ACCENT: string };
    expect(config.SPLASH_LIGHT).toBe(colors.light.background);
    expect(config.SPLASH_DARK).toBe(colors.dark.background);
    expect(config.ACCENT).toBe(colors.light.accent);
  });
});
