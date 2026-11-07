/**
 * Stable test IDs for the phone tests (Maestro). Every pressable in the kit gets one, built from its
 * role and its label: `button-done`, `tab-sola`, `mood-good`. The role prefix means a test tapping
 * by id can never hit Android's own UI (whose system Back button is also labelled "Back").
 */
export const testId = (role: string, label: string) =>
  `${role}-${label
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;

/** The app's own back button, on every screen that has one. */
export const BACK_ID = 'solace-back';
/** On the root and on every screen and sheet, so a test can always tell Solace is in front. */
export const ROOT_ID = 'solace-root';
