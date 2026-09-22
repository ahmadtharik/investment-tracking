# Deployment runbook

This app uses server-rendered Next.js routes, Supabase Auth/Postgres, and server-side market-data routes. Deploy the app on Vercel and connect it to a Supabase project. A separate project is safest for a public portfolio demo. If reusing an existing project, keep the personal account private, create a distinct test user with fictional data, and verify row-level isolation before sharing the URL or any demo credentials.

## 1. Prepare Supabase

1. Create or select the Supabase project that will back this deployment.
2. In its SQL editor, run `src/db/migrations/0001_init.sql` and then `src/db/migrations/0002_atomic_contributions.sql`. Do this only once per new project; review existing migration state before applying to an existing database.
3. Find the project URL, publishable/anon key, and service-role key in the Supabase dashboard. Do not commit any key or `.env.local`.

## 2. Import the Git repository into Vercel

1. In Vercel, choose **Add New → Project** and import the `investment-tracking` GitHub repository.
2. Keep the root directory at the repository root and the detected framework as Next.js. The existing `npm run build` script is the production build.
3. Add these variables to the **Production** environment before deploying:

   | Name | Value | Exposure |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser-visible |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key | Browser-visible |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key | Server-only secret |

   Mark the service-role key as sensitive if that option is available. Never give it a `NEXT_PUBLIC_` prefix. Do not paste secret values into issues, screenshots, or deployment logs. Use a separate backend for Preview deployments before adding credentials to that environment.

4. Deploy and record the assigned production URL. Git-connected deployments build automatically from subsequent pushes to the production branch.

## 3. Configure authentication redirects

In **Supabase → Authentication → URL Configuration**, set **Site URL** to the exact production origin, for example `https://your-project.vercel.app`. Add these **Redirect URLs**:

```text
https://your-project.vercel.app/api/auth/callback
https://your-project.vercel.app/api/auth/callback?next=/update-password
http://localhost:3000/api/auth/callback
http://localhost:3000/api/auth/callback?next=/update-password
```

Replace the example production host with the actual Vercel URL. If using a custom domain, add its corresponding callback URLs too. If OAuth sign-in is enabled, configure the OAuth provider for the Supabase project and verify its callback settings separately. For Preview deployments, configure a separate backend and explicitly allow its callback URLs.

## 4. Smoke-test the production URL

- Landing, sign-up, email confirmation, sign-in, sign-out, and password reset.
- Plan creation and editing; record a test contribution and verify account room decreases once.
- Dashboard, Portfolio, Accounts, Projections, and Settings with the demo user.
- Market quotes and history. If Yahoo Finance is unavailable from the deployed region, the cache may help temporarily, but the provider needs a server-side replacement or proxy. Never call it from the browser with a privileged key.
- Mobile layout and a fresh private-browser session, to catch authentication and caching problems.
- If sharing a test account, confirm that it cannot read or modify another user's profile, holdings, contributions, or settings. Keep screenshots and exported data limited to the fictional test account.

Do not publish the demo URL in the GitHub README until these checks pass. A shared test account can be modified by visitors, so prefer screenshots or a walkthrough until there is a resettable, restricted demo experience.
