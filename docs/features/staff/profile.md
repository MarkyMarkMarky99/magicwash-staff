# Staff profile

`/staff/:staffId` (`StaffProfilePage.vue`) shows one staff member's work score in standard minutes,
built from WorkTransactions. For admins, the staff list opens it for every row except a pending one,
which opens the edit form. Non-admins open the profile for every row. Only admins get an Edit link to that form.

The page reads `GET /api/work-transactions` for the last 14 Bangkok days (today included) every
time it is shown (the endpoint is in `NEVER_CACHE`; a new Bangkok day moves the period), and
computes everything in `src/features/staff/utils/staff-performance.ts`. Until that read succeeds
the results area shows a loading line or the error with Retry, never empty results. Minutes and job counts
include correction rows: a VOID lowers both, an ADJUSTMENT changes minutes only. The name and
details come from the prefetched staff list.

The page is dark (`bg-on-surface`) with lime as the accent and shows two views:

- **Day**: a strip of the last 7 days (today selected first; a dot marks a day with minutes). For
  the selected day it shows the minutes in a ring measured against the 7-day average of worked
  days, jobs completed, the rank among every staff member with minutes that day, and minutes by
  task (department).
- **Week**: the 7-day total against the previous 7 days, minutes per day as bars, and every staff
  member's 7-day total ranked, with this profile highlighted.

Only signed-in StaffIds earn minutes, so names come from `useStaffStore().nameOf`; an unknown id
shows as itself. Department labels are English; tickets whose id prefix is unknown show as Other.
