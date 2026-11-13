# smbERP

A modular application for small businesses, starting with employee project timesheets.

## Stack

- Expo, React Native, and TypeScript for the shared application.
- Supabase Auth for sign-in.
- Supabase Postgres for shared business data.

## Design

- [Timesheet requirements](docs/timesheet-requirements.md)
- [Application and database architecture](docs/architecture.md)

## Run the application

Requires Node.js 22.13+ and npm. The application targets Expo SDK 55, with shared iOS, Android, and web screens.

```sh
npm ci
cp .env.example .env
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env` using your Supabase project's connection details. Only use the public publishable key in the app.

```sh
npm start
```

Use Expo Go or a simulator for mobile, or run `npm run web` for a browser. Without configured credentials, the app displays setup instructions.

Set `EXPO_PUBLIC_DATE_FORMAT` in `.env` to control displayed dates. Supported values are `MM/DD/YYYY` (default), `DD/MM/YYYY`, and `YYYY-MM-DD`; values are case insensitive, and unsupported or empty values use the default. Restart Expo after changing it (rebuild exported apps). This applies to week ranges, work-date choices, time entries, and the date portion of approval history. Stored dates remain ISO dates; history timestamps use the device's local timezone and time display.

## Set up Supabase

1. Create a Supabase project and enable email/password authentication. Employee accounts are provisioned by the business; disable public sign-ups in Supabase Auth settings.
2. Run [the migration](supabase/migrations/202611110001_timesheets.sql) in the Supabase SQL editor, or apply it with the Supabase CLI to a linked project using `supabase db push`.
3. Create your initial administrator in Supabase Authentication → Users. The migration automatically creates an employee profile for each Auth user.
4. Run the following in the SQL editor, replacing the email, to grant the initial administrator role:

```sql
insert into public.user_roles(user_id, role)
select id, 'admin' from auth.users where email = 'admin@your-company.com'
on conflict do nothing;
```

5. Create manager and employee Auth accounts in the Supabase dashboard and supply their credentials through your normal onboarding process. Sign in as the administrator to grant manager roles, assign each employee an approving manager, create projects and activities, and assign projects to employees.
6. The business timezone defaults to `America/New_York`. Change it through the SQL editor if required:

```sql
update public.settings set business_timezone = 'America/New_York';
```

All timesheet writes use database functions. Row-level security protects reads and administration; employees cannot directly change approval states or edit submitted/approved entries through the API.

## Load demo data

Use a development Supabase project with the migration already applied.

1. In **Authentication → Users → Add user**, create and confirm these email/password users, choosing your own test passwords:
   - `admin@smberp.example`
   - `manager@smberp.example`
   - `alex@smberp.example`
   - `jordan@smberp.example`
2. Paste [the demo seed](supabase/seeds/demo.sql) into the Supabase SQL editor and run it as `postgres`.
3. Sign in to the app with one of the test accounts. Alex and Jordan have editable current-week drafts. Navigate to the previous three weeks for submitted, returned, and approved examples. Morgan's manager account can review the submitted weeks; the administrator can inspect projects and assignments.

The seed adds two projects, six activities, four assignments, eight timesheets, 32 entries, and ten history events. Entries include 0.5-hour and 8.5-hour examples to exercise warnings. Dates follow the configured business timezone. The existing settings row is preserved.

The script validates that all four Auth accounts exist before changing data and runs in a transaction. Rerunning it preserves existing demo weeks, entries, decisions, projects, and assignments; it restores demo profile names, active status, manager assignments, and required roles. Passwords and Auth users are managed through Supabase, not the seed.

## Included workflows

- **My timesheets:** navigate Monday–Sunday weeks, add/edit/delete daily project/activity entries, view totals and approval history, and submit a complete week.
- **Team approvals:** managers review submitted weeks assigned to them, approve them, or return them with a required reason.
- **Administration:** manage profile names, active status, roles, approving managers, projects, activities, and project assignments.
- Individual hours below 1 or above 8 appear in red with explanatory text, without blocking valid entries.

Accounts are created in the Supabase dashboard in this version. The app does not yet include email invitations, password recovery, notifications, exports, or multiple-business tenancy. No live Supabase project is provisioned by this repository.

## Verification

```sh
npm run typecheck
npm test
npx expo export --platform web
```

Tests cover date boundaries, hours validation and warnings, and a Postgres-compatible in-memory database running the actual migration. Database tests exercise ownership, project assignment checks, locked timesheets, required return reasons, resubmission versions, and approval history. A connected Supabase/mobile smoke test is still required before deployment.
