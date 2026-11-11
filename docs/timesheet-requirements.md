# Project timesheets

## Confirmed requirements

- The application will support multiple modules; project timesheets are the first module.
- Employees manually enter hours by date, project, and project activity.
- Employees can enter hours for past dates.
- Employees can split a day's hours across multiple projects and activities.
- Employees can select only projects assigned to them.
- All activities within an assigned project are available to that employee.
- Each timesheet covers Monday through Sunday and is submitted as a complete week.
- Each employee has one designated approving manager.
- Managers approve the whole weekly timesheet or return it for correction.
- Returning a timesheet requires a reason, visible to the employee.
- Employees correct returned timesheets and resubmit the complete week.
- Submitted and approved timesheets are locked against employee edits.
- Administrators manage employees, manager assignments, projects, activities, and project assignments.
- Hours below 1 or above 8 appear in red for each individual entry. These values do not block saving or submission. The thresholds are not applied to daily totals.
- There is no business limit on the total hours in a day.

## Proposed implementation defaults

These decisions support the first implementation and can be adjusted:

- Hours must be positive, with up to two decimal places. An empty cell is not an entry; zero-hour entries are omitted. Positive entries below 1 hour remain valid.
- An employee has one timesheet per week, including when it is returned and resubmitted.
- One entry per date, project, and activity; employees update its hours rather than create duplicate rows.
- A description is optional on each entry.
- Submission requires at least one entry and an active designated manager. It does not require entries on every day or a minimum weekly total.
- Future-dated entries are outside the initial scope; validation uses a configured business timezone rather than a device clock.
- The assigned approver is recorded on submission. Changing an employee's manager does not silently reroute a pending submission.
- Roles can overlap: a manager can enter their own timesheets and approve those assigned to them. Self-approval is prohibited.
- Approved timesheets have no reopening workflow in the initial module.
- Historical entries remain visible when projects, activities, employees, or assignments are deactivated.

## State transitions

| Current state | Action | Next state | Actor |
| --- | --- | --- | --- |
| Draft | Submit week | Submitted | Owning employee |
| Submitted | Approve week | Approved | Recorded approving manager |
| Submitted | Return with reason | Returned | Recorded approving manager |
| Returned | Correct entries | Returned | Owning employee |
| Returned | Resubmit week | Submitted | Owning employee |

Each submission, return, and approval is recorded in an append-only history. Employee edits are allowed only in Draft and Returned.
