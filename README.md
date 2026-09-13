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

3. Run [`src/db/migrations/0001_init.sql`](src/db/migrations/0001_init.sql) in the Supabase SQL editor. It creates the tables, policies, and starter instruments.

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and create an account. Configure the app from Settings before using the dashboard.

Run checks with `npm test` and `npx tsc --noEmit`.

## Deployment notes

The app deploys as a standard Next.js application on Vercel. Import the repository, set the three environment variables above for the required environments, and deploy. Keep the service-role key server-only. Run the Supabase migration before the first sign-in, then smoke-test sign-up, Settings, Dashboard, Portfolio, FX, Projections, and Rules on the deployed URL. Dynamic pages and market-data routes are intentionally configured to avoid stale personalized data.

If Yahoo Finance is unavailable from a serverless region, retain the database cache and move the market fetch behind a trusted Supabase Edge Function or small proxy; do not call Yahoo directly from the browser.
