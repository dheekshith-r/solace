# 03 Auth API (backend only)

## Must do
Spec sections 2.2, 3 and 4:
- `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`.
- `GET /me`, `PATCH /me`, `DELETE /me`, `GET /me/settings`, `PUT /me/settings`.

Details:
- Passwords hashed with argon2id (`@node-rs/argon2`). Email lowercased. `isAdult` must be true.
- Access JWT: 15 min, HS256, `sub` = user id (`jose`).
- Refresh token: random 32 bytes, stored hashed, 30 days, rotated on every refresh. Reusing an old token revokes its whole family.
- Logout revokes the refresh token.
- Zod schemas live in `packages/shared` and validate requests and type responses (`fastify-type-provider-zod`).
- Errors use the shape `{ error: { code, message } }`.
- Rate limits: auth 10/min per IP, everything else 120/min per user (`@fastify/rate-limit`).
- Also `@fastify/helmet` and `@fastify/sensible`.
- `GET /me` returns stats: xp, level, streak and xpToNext, computed as in spec section 3, with the streak in the user's timezone.
- Signup also accepts optional `goal`, `timezone` and `reminders` (decision 5).

## Files
`apps/api/**` and `packages/shared/**` only.

## Must not touch
`apps/mobile`. Never print or commit secrets.

## Decisions
- Packages, all listed in spec 1.2: `@node-rs/argon2`, `jose`, `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/sensible`, `fastify-type-provider-zod`.
- Tests run migrations on `TEST_DATABASE_URL` before the suite and truncate tables between tests.
- Once it passes review, these commits are cherry-picked to `main` so Render deploys them.
