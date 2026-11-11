# Application and database architecture

This document describes the module boundaries and database rules. The initial implementation uses a small role-aware navigation shell in `App.tsx`; Expo Router can be introduced as more modules are added.

## Application structure

Use an Expo application with TypeScript. Keep shared identity and navigation separate from business modules so future modules can reuse them.

```text
App.tsx                      Sign-in, session, and role-aware navigation
src/
  core/supabase.ts           Client and session persistence
  core/types.ts              Shared business types
  core/ui.tsx                Shared controls and feedback
  modules/timesheets/        Entry editor, weekly totals, validation
  modules/approvals/         Review and decision actions
  modules/administration/    Reference data management
supabase/
  migrations/                Schema, constraints, policies, functions
tests/                       Domain and database workflow checks
docs/                        Requirements and design
```

The weekly editor shows dates from Monday to Sunday, project/activity selections, entered hours, daily totals, weekly total, status, and the latest return reason. Red hours must also have a text explanation so color is not the only signal.

The manager queue opens the complete submitted week with entries, totals, and decision history. Returning requires a reason; approving and returning operate on the entire week.

## Data model

Use UUID primary keys, audit timestamps, foreign keys, and explicit database constraints. Use Postgres `date` for work dates and week starts, `timestamptz` for events, and exact `numeric` values for hours.

| Table | Main fields and rules |
| --- | --- |
| `profiles` | `id` references Supabase `auth.users`, display name, active flag, `manager_id` references another profile; prevent self-management |
| `user_roles` | Profile and role (`employee`, `manager`, `admin`); unique pair; roles may overlap |
| `projects` | Unique code, name, active flag |
| `project_activities` | Project, code, name, active flag; code unique within project |
| `project_assignments` | Employee, project, active flag; unique employee/project pair |
| `timesheets` | Employee, Monday `week_start`, status, recorded `approver_id`, submission version, latest submission timestamp, decision timestamp; unique employee/week |
| `time_entries` | Timesheet, work date, project, activity, positive `numeric` hours with two decimal places, optional description; unique timesheet/date/project/activity |
| `timesheet_events` | Timesheet, actor, event type, submission version, timestamp, return reason when applicable; append-only |

An entry's activity must belong to its project, enforced with a composite foreign key. Database validation ensures its work date falls within the parent timesheet's seven days. The week start must be a Monday.

Avoid a daily sum limit and avoid an hours column precision that implicitly caps an individual entry at 8 or a daily total at 24. The red warning is presentation behavior, not a rejection rule.

## Authorization

Enable row-level security on every exposed table. A signed-in user may read their own profile and timesheets. Managers may read the employee details and timesheet data needed to review submissions assigned to them. Administrators manage reference data and assignments. Employees can read their assigned projects and their activities, plus historical project/activity labels referenced by their own entries.

Role checks use protected database role records. Users cannot change their own roles, manager, or active flag. Administrative access does not automatically grant permission to approve or alter locked timesheets.

Entry insert, update, and delete operations must verify ownership, editable parent status, project assignment, and valid activity. Updating an entry must check both its existing and resulting parent to prevent moving a row into a locked or another employee's timesheet.

Use restricted database functions for submission, approval, and return. Clients cannot directly update status, approver, decision timestamps, or event history. Privileged functions must use a fixed search path, verify the authenticated actor, and expose only necessary execution grants.

Never place the Supabase service-role key in the Expo application. The application uses the public client key with the signed-in session and row-level security. Account provisioning requiring privileged Auth operations runs on a trusted server or Supabase Edge Function.

## Transactional workflow

Every entry mutation and workflow action locks the parent timesheet row in the same transaction. This serializes entry edits against submission and prevents changes while a manager decides on a week.

Submission verifies employee ownership, editable status, at least one entry, and an active manager other than the employee. It revalidates assignments and activities, captures the manager, increments the submission version, changes status, and appends an event atomically.

Approval and return verify Submitted status, the recorded approver, and the expected submission version. Return additionally requires a nonblank reason. Each action changes status and appends its event atomically. Version checks prevent a stale manager screen from acting on a later resubmission.

Reference-data deactivation must preserve historical records. Draft or returned entries referencing inactive projects, activities, or assignments remain visible for correction, but cannot be submitted until valid. Manager review of an already submitted week must remain possible after reference-data changes.

## Initial implementation sequence

1. Create the Expo TypeScript application, environment configuration, and Supabase client.
2. Implement schema migrations, role policies, and transactional workflow functions.
3. Add sign-in and administrator management screens.
4. Add the employee weekly editor, history, and submission flow.
5. Add manager review, approval, and return flow.
6. Verify access boundaries, Monday/Sunday boundaries, historical entry, decimal-hour warnings, locking, required return reasons, and stale approval handling.

The initial design assumes one business. Organization-level tenancy, deployment targets, sign-in method, and the business timezone need to be established before production deployment.
