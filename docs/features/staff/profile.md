# Staff profile

`/staff/:staffId` (`StaffProfilePage.vue`) shows one staff member's work score in standard minutes,
built from WorkTransactions. For admins, the staff list opens it for every row except a pending one,
which opens the edit form. Non-admins open the profile for every row. Only admins get an Edit link to that form.

The page reads `GET /api/work-transactions` for the last 14 Bangkok days (today included) every
time it is shown (the endpoint is in `NEVER_CACHE`; a new Bangkok day moves the period), and
computes everything in `src/features/staff/utils/staff-performance.ts`. Until that read succeeds
the results area shows a loading line or the error with Retry, never empty results. Minutes and job counts
include correction rows: a VOID lowers both, an ADJUSTMENT changes minutes only. The name and
details come from the prefetched staff list. Daily and weekly rankings exclude assistants using
the credited StaffId. A secretary's reversal of a human award still counts against the original recipient.

The member's departments show as small chips under the subtitle (same English labels as the task rows; nothing renders when there are none).

The page is the same dark report layout as the Orders report (`docs/features/orders/order-report.md`),
built from the shared report components in `src/shared/components/reports/`. The pull-to-refresh scroll
region reloads the scores and the assignments. A floating Day and Week pill is pinned to the bottom
(the view is local state; Day opens first). Top to bottom: the header (avatar, name, subtitle,
department chips, the "Staff actions" menu), the caption "Last 7 days · from – to" (no arrows: the
page only reads 14 days), then one of two views:

- **Day**: a lime label naming the selected day, then a ring of the day's minutes against the 7-day
  average of worked days (capped at a full circle; the note under it gives the exact percentage) beside
  three cards: jobs completed, rank among every staff member with minutes that day, and the 7-day
  average. Under it the seven-day picker (minutes per day; today selected first; a day is always
  selected), then "By task" (minutes by department, with jobs) or "No completed jobs this day."
- **Week**: the 7-day total against the previous 7 days, minutes per day as bars (today in lime), and
  "All staff" ranking every member's 7-day total with this profile highlighted.

## Open assignments

A card "Open assignments" closes both views, listing the member's open assignments from
`GET /agents/personal/assignments?status=open&staffId=<id>` through `useStaffOpenAssignmentsStore`
(`src/data/team-agent/`). It reloads on every visit and on pull-to-refresh. Admins see it on any profile
and pass the profile's `staffId`; a staff viewer sees it only on their own profile and calls without
`staffId` (the gateway rejects another id); other viewers and every `device` account see nothing, and
no request is made. The section is hidden when there are no open assignments; a failed read shows a
quiet "Could not load assignments" line with Retry. Each item is the shared `AssignmentCard` without
the assignee line. For admins a tap opens the Assignments page (`personal-assignments`); for staff the
cards are not tappable. Visibility rules live in `assignmentAccess` (`src/features/staff/utils/staff-report.ts`).

Only signed-in StaffIds earn minutes, so names come from `useStaffStore().nameOf`; an unknown id
shows as itself. Department labels are English; tickets whose id prefix is unknown show as Other.
