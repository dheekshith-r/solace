# 03 Eval

## API tests (vitest + Fastify inject, test database)
- Signup:
  - Returns user and both tokens.
  - A duplicate email returns 409.
  - `isAdult: false` returns 400.
  - A password under 8 characters returns 400.
  - Email is stored lowercased.
- Login: wrong password and unknown email return the same 401 message.
- Refresh:
  - Returns a new pair, and the old token stops working.
  - Reusing the old token returns 401 and revokes the newer token too (family).
- Logout: afterwards, refresh with that token returns 401.
- Protected routes:
  - No token, a bad signature or an expired token returns 401.
  - A valid token returns 200.
- `PATCH /me` updates name, goal, personalize and timezone, and rejects unknown fields.
- `DELETE /me` cascades to every child table.
- Settings: PUT then GET round-trips the reminders JSON. An invalid time returns 400.
- Stats:
  - XP and level math is correct.
  - The streak counts consecutive local days.
  - A day boundary check: activity at 23:30 and 00:30 in Asia/Kolkata counts as two days.
- Rate limit: the 11th auth call within a minute returns 429.
- No response or log line contains a password, hash or token secret.

## Live (after deploy)
`curl` against `https://solace-api-dvjz.onrender.com`: signup, me, refresh, logout, using a throwaway test email that is deleted afterwards with `DELETE /me`.
