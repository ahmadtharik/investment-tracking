# Investment Planner

Investment Planner is a private, multi-user Next.js app for turning monthly income and expenses into an investment plan. It supports TFSA/RRSP allocation, contribution-room tracking, holdings, CAD/USD FX calculations, projections, historical backtests, and live Yahoo Finance quotes.

## Stack

- Next.js App Router, React, TypeScript, and Tailwind CSS
- Supabase Postgres, Auth, and row-level security
- Yahoo Finance server-side market data with a short-lived database cache
- Recharts for interactive charts and Vitest for engine tests

## Local setup

1. Install Node.js (the project is tested with Node 20+), then install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project. Copy `.env.example` to `.env.local` and fill in:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose it to the browser)

3. Run [`src/db/migrations/0001_init.sql`](src/db/migrations/0001_init.sql), then [`src/db/migrations/0002_atomic_contributions.sql`](src/db/migrations/0002_atomic_contributions.sql), in the Supabase SQL editor. They create the schema, policies, starter instruments, and atomic contribution recording.

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and create an account. Set your financial plan inputs on the Plan page before using the dashboard.

Run checks with `npm test` and `npx tsc --noEmit`.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Vercel and Supabase setup, authentication redirects, and post-deployment checks. Keep the service-role key server-only.
