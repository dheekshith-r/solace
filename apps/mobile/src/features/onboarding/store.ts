import { DEFAULT_REMINDERS, type Reminders } from '@solace/shared';
import type { GOALS } from '@solace/shared/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '../../lib/storage';

export type Goal = (typeof GOALS)[number];
export type ReminderKind = 'checkin' | 'affirmation' | 'breathe';
export type Permission = 'unknown' | 'granted' | 'denied';

export const ONBOARDING_STEPS = 4;

type OnboardingState = {
  step: number;
  goal: Goal | null;
  reminders: Reminders;
  permission: Permission;
  done: boolean;
  setStep: (step: number) => void;
  setGoal: (goal: Goal) => void;
  toggleReminder: (kind: ReminderKind, on: boolean) => void;
  setPermission: (permission: Permission) => void;
  /** Reminders stay as chosen only if the phone allows notifications. */
  finish: (remindersAllowed: boolean) => void;
  reset: () => void;
};

const initial = { step: 0, goal: null, reminders: DEFAULT_REMINDERS, permission: 'unknown' as Permission, done: false };

/** What the user chose before an account exists. Sent with sign-up (ticket 05), kept across restarts. */
export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initial,
      setStep: (step) => set({ step: Math.max(0, Math.min(ONBOARDING_STEPS - 1, step)) }),
      setGoal: (goal) => set({ goal }),
      toggleReminder: (kind, on) => set((s) => ({ reminders: { ...s.reminders, [kind]: { ...s.reminders[kind], on } } })),
      setPermission: (permission) => set({ permission }),
      finish: (remindersAllowed) =>
        set((s) => ({
          done: true,
          reminders: remindersAllowed
            ? s.reminders
            : {
                ...s.reminders,
                checkin: { ...s.reminders.checkin, on: false },
                affirmation: { ...s.reminders.affirmation, on: false },
                breathe: { ...s.reminders.breathe, on: false },
              },
        })),
      reset: () => set(initial),
    }),
    { name: 'onboarding', storage: createJSONStorage(() => zustandStorage) },
  ),
);
