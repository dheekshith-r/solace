import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '../../lib/http';

const DAY_MS = 24 * 60 * 60 * 1000;
// The shape is checked by parseResources, which keeps whatever is usable.
const passThrough = z.unknown();

export type Guide = { slug: string; title: string; summary: string; minutes: number; sections: { heading: string; body: string }[] };
export type GetHelp = { helpline: { name: string; number: string; hours: string }; emergencyNumber: string; note: string };
export type Resources = { guides: Guide[]; getHelp: GetHelp };

/** Always available, even offline on first launch: the helpline must never depend on the network. */
export const OFFLINE_HELP: GetHelp = {
  helpline: { name: 'Tele-MANAS', number: '14416', hours: 'Free, confidential, 24 hours a day' },
  emergencyNumber: '112',
  note: 'Solace is not a substitute for professional care.',
};

function parseResources(value: unknown): Resources {
  const v = value as Partial<Resources> | null;
  const guides = Array.isArray(v?.guides)
    ? v.guides.filter((g): g is Guide => typeof g?.slug === 'string' && typeof g?.title === 'string' && Array.isArray(g?.sections))
    : [];
  return { guides, getHelp: v?.getHelp?.helpline?.number ? v.getHelp : OFFLINE_HELP };
}

/** GET /resources: static guides, cached on the phone for a day so they open offline. */
export function useResources() {
  return useQuery({
    queryKey: ['resources'],
    queryFn: async () => parseResources(await request<unknown>('/resources', { schema: passThrough })),
    staleTime: DAY_MS,
  });
}
