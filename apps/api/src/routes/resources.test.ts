import { resourcesResponseSchema } from '@solace/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

// No database: /resources is static and public.
const app = () => buildApp({ pingDb: async () => {} });

describe('GET /resources', () => {
  it('returns five guides and the help numbers, matching the shared schema, without auth', async () => {
    const response = await app().inject({ method: 'GET', url: '/resources' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=3600');

    const body = resourcesResponseSchema.parse(response.json());
    expect(body.guides.map((g) => g.slug)).toEqual([
      'mindfulness-101',
      'anxiety-toolkit',
      'beating-the-blues',
      'self-esteem-reset',
      'sleep-wind-down',
    ]);
    for (const guide of body.guides) {
      expect(guide.sections.length).toBeGreaterThanOrEqual(3);
      expect(guide.sections.length).toBeLessThanOrEqual(5);
      expect(guide.minutes).toBeGreaterThan(0);
      for (const section of guide.sections) expect(section.body.length).toBeGreaterThan(40);
    }
    expect(new Set(body.guides.map((g) => g.slug)).size).toBe(5);

    const anxiety = body.guides.find((g) => g.slug === 'anxiety-toolkit');
    expect(JSON.stringify(anxiety)).toContain('5-4-3-2-1');

    expect(body.getHelp).toEqual({
      helpline: { name: 'Tele-MANAS', number: '14416', hours: '24x7, free', emergencyNumber: '112' },
      emergencyNumber: '112',
      note: 'Solace is not a substitute for professional care.',
    });
  });

  it('makes no medical claims', async () => {
    const text = (await app().inject({ method: 'GET', url: '/resources' })).body.toLowerCase();
    for (const word of ['cure', 'diagnos', 'treatment for', 'guaranteed', 'medication']) {
      expect(text).not.toContain(word);
    }
  });
});
