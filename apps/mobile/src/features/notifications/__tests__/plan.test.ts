import { DEFAULT_REMINDERS } from '@solace/shared';
import { shiftTime } from '../../../components/TimeStepper';
import { planReminders, routeForUrl } from '../plan';

describe('reminder plan', () => {
  it('schedules only what is on, at the chosen times, with the right link', () => {
    const plan = planReminders(DEFAULT_REMINDERS);
    expect(plan.map((p) => [p.identifier, p.hour, p.minute, p.channel, p.url])).toEqual([
      ['checkin', 20, 0, 'checkin', 'solace://checkin'],
      ['affirmation', 9, 0, 'affirmation', 'solace://today'],
    ]);
  });

  it('includes custom reminders and skips the ones turned off', () => {
    const plan = planReminders({
      ...DEFAULT_REMINDERS,
      breathe: { on: true, time: '13:30' },
      custom: [
        { id: 'a', label: 'Drink water', time: '11:15', on: true },
        { id: 'b', label: 'Stretch', time: '16:00', on: false },
      ],
    });
    expect(plan.map((p) => p.identifier)).toEqual(['checkin', 'affirmation', 'breathe', 'custom-a']);
    expect(plan.find((p) => p.identifier === 'custom-a')).toMatchObject({ hour: 11, minute: 15, title: 'Drink water', channel: 'custom' });
    expect(plan.find((p) => p.identifier === 'breathe')?.url).toBe('solace://breathe');
  });

  it("uses today's affirmation when it is known", () => {
    const plan = planReminders(DEFAULT_REMINDERS, { affirmation: 'You can go slowly and still arrive.' });
    expect(plan.find((p) => p.identifier === 'affirmation')?.body).toBe('You can go slowly and still arrive.');
  });

  it('opens only known screens from a tap', () => {
    expect(routeForUrl('solace://checkin')).toBe('/today');
    expect(routeForUrl('solace://breathe')).toBe('/breathe');
    expect(routeForUrl('https://evil.example')).toBeNull();
    expect(routeForUrl(undefined)).toBeNull();
  });

  it('steps times around midnight', () => {
    expect(shiftTime('23:30', 60)).toBe('00:30');
    expect(shiftTime('00:10', -15)).toBe('23:55');
  });
});
