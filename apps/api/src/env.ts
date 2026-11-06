import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  GEMINI_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // Proxies in front of the API whose addresses are trusted. Render: 3, measured on Nov 6 2026: the socket is a
  // local sidecar (127.0.0.1), then Render's load balancer (10.x), then a Cloudflare edge (104.x, varies per
  // request). The next X-Forwarded-For entry is the real client, appended by Cloudflare; anything further left
  // was written by the client and is never trusted.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(3),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Names only: values are secrets and must never reach the logs.
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment variables: ${names}`);
  }
  return parsed.data;
}
