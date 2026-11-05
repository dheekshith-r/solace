import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  // Shared ships as TypeScript source, so it must be bundled rather than imported at runtime.
  noExternal: ['@solace/shared'],
});
