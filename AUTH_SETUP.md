# Login and private lab notebook

This branch adds Clerk authentication and a Supabase Postgres database. The simulator is protected by middleware and a server-side auth check. The API independently checks the session. There is no guest bypass.

## Local setup

1. Run `npm ci` (Node.js 22 or later recommended).
2. Copy `.env.example` to `.env.local`.
3. Fill `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from your Clerk application. The secret key is server-only. Do not add a `NEXT_PUBLIC_` prefix to it.
4. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project. Do not use a service-role or secret database API key. All app database access uses the user's Clerk session and row-level security.
5. Enable the native Supabase integration in Clerk. In Supabase Authentication > Sign In / Providers > Third-Party Auth, add Clerk with the corresponding Clerk instance domain. Do not create a legacy JWT template or share a Supabase JWT signing secret.
6. Apply `supabase/migrations/202611160001_user_runs.sql` once to an empty project. It has already been applied to the lab project created for this branch. Do not run it a second time there.
7. Run `npm run dev` and open `http://localhost:3000`. Sign up or sign in.
8. Choose inputs and select **Save run**. Open **My history** to see your latest 20 saved runs. **Restore inputs** loads a saved run's inputs without creating another record.

The app uses explicit saves, not every slider movement. It sends only simulation inputs, solver tolerance and a retry ID. The server validates inputs and recomputes all stored outputs using the same hydraulics module as the simulator. Failed/invalid runs are not saved. Retries of a request use a per-user unique key to avoid duplicate records. Successful intentional repeat saves create new records.

A profile is synced from the authenticated Clerk account when the lab notebook loads and again before a save. This is not a full Clerk user mirror: users who never load the app are not copied, and account deletion is not automatically synced. There are no teacher/admin dashboards or cross-user data exports in this change.

## Tables

- `user_profiles`: Clerk user ID (text primary key), primary email, name, creation/update timestamps.
- `simulation_runs`: UUID, Clerk user ID, request UUID, channel shape, JSON inputs (Q, g, y, B, m, D), tolerance, Froude number, critical depth, specific energy, flow regime, complete computed result JSON, server timestamp.

RLS is enabled on both tables. Authenticated users can select and insert only their own rows and update only their own profile. Anonymous users have no table grants. Run history is immutable through the app. A user ID from a request body is rejected, not trusted. Browser clients must be considered untrusted; profile fields are for display, not authorization.

## Verification

`npm run typecheck`, `npm test`, and `npm run build` pass. Tests cover the rectangular reference, all four geometries, and invalid/spoofed input rejection. Live integration checks used reserved development test accounts: protected sign-in redirect, real Clerk sessions, a saved run, history after reload, idempotent replay, invalid API input (400), signed-out API denial (401), anonymous database denial, empty cross-user reads and denied cross-user inserts (403).

## Before production

- This setup uses a Clerk **development** instance and a free Supabase project. Configure a Clerk production instance, production domain/OAuth credentials, and its matching Supabase third-party provider before a production launch. Never enable Clerk Test mode in production.
- Add these environment variables in the deployment platform for the relevant environment. `.env.local` is not committed or uploaded. Do not merge the branch into a live deployment before its environment is configured.
- Existing Next.js 14 dependencies have high/critical npm audit advisories. This feature branch preserves the framework major version. Upgrade to a currently patched supported release separately before a public launch.
- Add production rate limiting and retention/deletion controls as usage grows. Free service quotas apply; no paid plan or payment method was added.
- Deleting a Clerk user does not delete the Postgres profile automatically. An administrator can delete the corresponding `user_profiles` row; its runs cascade-delete. A production app should implement a verified Clerk deletion webhook and a user-facing deletion process.

## Rollback

Keep `main` unchanged while reviewing this branch. Reverting the branch restores the previous app. The database is separate from the old app and has no existing user data. Export any wanted data before deleting the lab project, or drop `simulation_runs` before `user_profiles` if removing only this schema.
