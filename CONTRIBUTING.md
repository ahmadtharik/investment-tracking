# Contributing

Thanks for considering a contribution to Investment Planner.

## Development

1. Fork the repository and create a focused branch.
2. Copy `.env.example` to `.env.local` and supply your own Supabase project values.
3. Install dependencies with `npm install`.
4. Run `npm test` and `npm run build` before opening a pull request.

## Pull requests

- Keep changes focused and explain the user-facing outcome.
- Include screenshots for visual changes and test coverage for calculation or data-access changes.
- Do not commit `.env.local`, credentials, session data, or real financial records.
- Preserve the app's planning-only language: it does not place trades, transfer money, or provide investment advice.
