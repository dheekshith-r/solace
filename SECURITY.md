# Security policy

## Report a problem in private

If you find a security problem in Solace, do not open a public issue.

1. Open the [private report form](https://github.com/dheekshithsnewjourney-crypto/solace/security/advisories/new).
2. Describe the problem and the steps to see it.
3. Send the report.

You will get an answer within 7 days. When the fix is live, the report can be made public, with credit to you if you want it.

## What is in scope

- The Solace Android app and the API at https://solace-api-sg.onrender.com
- The code in this repository

## Supported versions

Only the live version, built from `main`, gets fixes.

## How Solace protects your data

- Passwords are hashed with Argon2id. Unknown emails take the same time to check as known ones.
- Access tokens last 15 minutes. Refresh tokens are stored only as a SHA-256 hash, rotate on every use, and a reused old token revokes the whole family.
- On the phone, tokens live in the secure store (`expo-secure-store`).
- The API has rate limits (sign-in 10 per minute per IP, messages 20 per minute per user), a 32 KB body limit, security headers (helmet) and log redaction of passwords, tokens and bodies.
- Every typed message gets a crisis check before any AI call. On a match, the AI is not called, and the app shows the helpline (Tele-MANAS 14416, emergency 112).
- Deleting the account deletes every row that belongs to the user.
- Secrets (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`) live only in Render's environment, never in git.
