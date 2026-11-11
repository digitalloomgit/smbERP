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
