# Local setup: Open Channel Energy Lab

Use the `feature/next15-upgrade` branch. It includes login, private saved runs and the owner-only admin dashboard. `main` and the existing deployment are separate and unchanged.

## 1. Install prerequisites and get the code

Install Git, Node.js 22 LTS (or a newer compatible LTS) and npm. Check `git --version`, `node --version` and `npm --version` in a terminal.

```sh
git clone https://github.com/nayan281206/open-channel-energy-lab.git
cd open-channel-energy-lab
git switch feature/next15-upgrade
npm ci
```

The repository is private. Sign into GitHub Desktop or your Git credential manager as an account with access. In GitHub Desktop, clone this repository, select `feature/next15-upgrade` in Current Branch, then Repository > Open in Terminal. Run the same npm commands there. `npm ci` installs the exact lockfile; use `npm install` only when intentionally changing dependencies.

## 2. Create your private environment file

macOS/Linux:

```sh
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` in your editor. Fill these values, without angle brackets:

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
CLERK_SECRET_KEY=sk_test_REPLACE_ME
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
ADMIN_USER_IDS=
SUPABASE_SECRET_KEY=sb_secret_REPLACE_ME
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

The first four credentials are needed for ordinary login and saved runs. The admin dashboard also requires the last two server settings, `ADMIN_USER_IDS` and `SUPABASE_SECRET_KEY`. Empty admin configuration gives nobody admin access. Never add `NEXT_PUBLIC_` to a secret key or the admin allowlist. Never commit `.env.local`, paste secrets in an issue or send them in chat.

### Where to get each value

- Clerk app: https://dashboard.clerk.com/apps/app_3MC09piGrXELJrskpnfWHipRYp5/instances/ins_3MC09ohHE84FQ3WIMlvHTVgbIVB . Use Open Channel Energy Lab, Development. The manual setup screen / Configure > API keys provides the publishable key (`pk_test_...`) and secret key (`sk_test_...`). Both must belong to the same instance. The development secret is also saved in your personal vault as **Energy Lab Clerk development API key**. Use its secure access link while valid; after it expires, copy from the Clerk dashboard rather than expecting to retrieve a saved vault secret.
- Supabase project: https://supabase.com/dashboard/project/bmczwjmbbsajqvhgsian . The project's Data API settings show the Project URL. For this lab the project reference is `bmczwjmbbsajqvhgsian`.
- Supabase Project Settings > API Keys: copy the **Publishable key** (`sb_publishable_...`) to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- On that same page, reveal the **Secret key** (`sb_secret_...`) and put it only in `SUPABASE_SECRET_KEY`. This bypasses RLS and is used only by the admin server path after checking the signed-in Clerk user ID. The key is saved in your vault as **Energy Lab Supabase server secret key**; use its secure access link while valid or copy from Supabase.
- **Energy Lab Supabase database** in your vault is the Postgres database password, not either API key. The running app does not need that password. It is for administrative SQL connections only.

## 3. Confirm authentication and database setup

For the existing lab project, the native Clerk/Supabase integration and migration have already been applied. Both migrations have already been applied there. Do not re-run the initial table-creation migration.

For a fresh project:

1. Create a Clerk application and a Supabase project you control; replace all four credential values with that new pair.
2. Enable Supabase in Clerk's integrations. In Supabase Authentication > Sign In / Providers > Third-Party Auth, add Clerk using the matching Clerk instance domain. Use native third-party auth, not a legacy JWT template. The provider instance must match the Clerk keys.
3. Open Supabase SQL Editor. Run the entire `supabase/migrations/202611160001_user_runs.sql` then `supabase/migrations/202611160002_admin_read_grants.sql`, in order, against an empty database. The first creates `user_profiles`, `simulation_runs`, indexes, grants and own-user RLS policies in a transaction. The second gives only SELECT access to the server service role for the admin monitor. Never disable RLS to fix a permissions error.
4. If the web editor corrupts pasted SQL, stop rather than running a partial statement. Use a PostgreSQL client over a certificate-verified connection with your own project credentials.

## 4. Start, sign in and make yourself admin

```sh
npm run dev
```

Open http://localhost:3000 . Sign up or sign in with your own account. Dashboard ownership is separate from having a user account in the app.

1. In the same Clerk development app, open **Users** and select the app account you just used. Check its email/name before copying its **User ID** (`user_...`). Do not use the Clerk dashboard account ID, application ID or instance ID.
2. Put that exact ID into `.env.local`:

   ```dotenv
   ADMIN_USER_IDS=user_YOUR_ACTUAL_CLERK_USER_ID
   ```

3. Stop the terminal server with Ctrl+C, then run `npm run dev` again. Environment changes require a restart. Build again if using `npm start`.
4. Sign in as that account and click **Admin** in the simulator header, or open http://localhost:3000/admin .
5. Multiple explicitly trusted admins can be configured as comma-separated Clerk IDs. Removing an ID and restarting removes its access. Never add an unverified ID.

No real owner app account existed when this feature was built, so no owner ID or test ID is committed. The first person to sign up does **not** automatically become admin.

## 5. Use and verify

- Simulator: adjust inputs and choose **Save run**. My history shows your own latest 20 saves; Restore inputs does not create another run.
- Admin: all registered Clerk users, including users without a saved profile; names/emails/verified contact information, joined/last sign-in/last active, account status, providers, MFA status, notebook sync timestamp and saved-run counts. Search and page through users. View details filters the run list to that user. Expand any run for all stored input/result fields and identifiers. Runs are paginated, 25 at a time, with manual refresh.
- Totals show registered users, saved runs and saves during the last seven days. Activity is **explicit saves**, not every slider movement, page view, session duration or live presence. Clerk's activity timestamps may lag. The notebook timestamp means last profile sync, not continuous presence.
- Check a second account: `/admin` must show access required, `/api/admin` must return 403, and My history must not show another user's runs. Signed-out API requests return 401. The denial page itself renders a safe explanation; the API enforces the 403.
- Private metadata, auth tokens, passwords and service credentials are not exposed in the dashboard. This is a read-only monitor, not a user-management/delete tool. Existing run history is immutable through the app.

## 6. Tests and production-mode local build

```sh
npm run typecheck
npm test
npm run build
npm start
```

Stop the dev server before starting the production server; both default to port 3000. Unit tests cover input validation, hydraulic references, exact admin allowlist matching and pagination. Integration checks require real Clerk development sessions and configured Supabase, not only unit tests.

## 7. File map

- `src/app/page.tsx`, `src/components/Simulator.tsx`: protected simulator and owner-only admin link.
- `src/app/admin/page.tsx`, `src/components/AdminDashboard.tsx`: server access gate and read-only dashboard.
- `src/app/api/admin/route.ts`, `src/lib/admin-server.ts`, `src/lib/admin.ts`: per-request admin authorization and privileged server reads.
- `src/app/api/profile/route.ts`, `src/app/api/runs/route.ts`: regular-user profile/save/history endpoints.
- `src/lib/supabase-server.ts`: Clerk-token client, protected by own-row RLS.
- `src/lib/profile-server.ts`: trusted Clerk profile sync.
- `src/lib/hydraulics.ts`, `src/lib/runs.ts`: calculations and server validation/recomputation.
- `supabase/migrations/`: schema/RLS and server-only admin read grants.
- `.env.example`: blank configuration template; `AUTH_SETUP.md`: security, schema and production notes.
- `tests/`: unit tests. No secrets or real admin IDs belong here.

## Troubleshooting and release limits

- Missing key/invalid publishable key: check `.env.local` in the project root, correct Clerk instance and restart.
- Login works but saves fail: check the Supabase URL/publishable key, native Clerk provider and migration. Do not substitute a secret key in the public variable.
- Admin access required: verify the signed-in app user's exact ID in `ADMIN_USER_IDS`, comma separators and restart.
- Admin data error: check server-only `SUPABASE_SECRET_KEY`, Clerk secret and table schema. Regular notebook access does not prove admin credentials are configured.
- Port busy: stop the other server, or run `npm run dev -- -p 3001` and use that URL.
- No runs: only successful explicit saves are recorded. A Clerk user can legitimately have no Postgres profile yet.
- This remains a Clerk development instance. Configure a production Clerk instance/domain/OAuth credentials, matching Supabase provider and deployment environment variables before a launch.
- This branch uses Next.js 15.5.29 and Clerk 7.10.0 with React 19 and matching React Three Fiber 9 / Drei 10. Existing Next 14 / Clerk 6 installations cannot use the current sign-in service. Run `npm ci` after switching branches. Remaining transitive dependency advisories should be reviewed before a wider launch; do not run `npm audit fix --force` without reviewing major changes.
- Free service quotas apply. Add rate limits, retention/deletion controls and a verified Clerk deletion webhook before wider use. Deleting a Clerk account does not automatically remove its database profile; deleting its `user_profiles` row administratively cascades its runs.
- Users should be told the owner can inspect their saved activity and profile information. Do not store sensitive personal data in simulation fields.
