// Deep links handled by the app (spec section 6.1).
export const DEEP_LINKS = {
  today: 'solace://today',
  checkin: 'solace://checkin',
  breathe: 'solace://breathe',
  newConversation: 'solace://sola/new',
  conversation: (id: string) => `solace://sola/${id}`,
} as const;
