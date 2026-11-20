# Contributing to Solace

Thank you for your help. Bug reports and ideas are the most useful help.

## Report a bug or suggest an idea

1. Open [a new issue](https://github.com/dheekshithsnewjourney-crypto/solace/issues/new/choose).
2. Choose "Bug report" or "Idea".
3. Fill in the form. Do not paste private data; issues are public.

For a security problem, follow [SECURITY.md](./SECURITY.md) instead.

## Change the code

1. Fork the repository and make a branch from `main`.
2. Set it up:
   ```bash
   npm install
   cp apps/api/.env.example apps/api/.env   # then fill in the values
   npm run dev -w @solace/api
   ```
3. Make your change. Keep it small and about one thing.
4. Run the checks:
   ```bash
   npm run test
   npm run typecheck
   npm run lint
   ```
5. Open a pull request and fill in the template.

## Rules for every change

- Every promise on the website and in the README must be true in the product.
- Do not weaken or skip a test to make it pass.
- Never put secrets in code or in git history.
- Sola must never invent details the user did not log, and never replace professional help. Keep the crisis check in front of every AI call.
- Every control needs a label and a 44 px touch target. Text must pass WCAG AA contrast.

## Code of conduct

Everyone who takes part follows the [code of conduct](./CODE_OF_CONDUCT.md).
