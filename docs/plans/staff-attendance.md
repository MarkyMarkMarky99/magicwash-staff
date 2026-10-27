# Plan — staff attendance and day-off booking

Status: **planned, not built.** When phase 1 ships, move the rules below into
`docs/features/staff/attendance.md` and keep this file as build history.

## Goal

Staff pick their own weekly day off in the app instead of the owner fitting days by hand.
Attendance (who worked which day) comes from `WorkTransactions`; there is no check-in.

## Decisions — do not reopen

1. One sheet, `Attendance`, in the Staff spreadsheet (`STAFF_SPREADSHEET_ID`).
2. One row per staff per work date. Soft delete with `deleted_at` / `deleted_by` like other sheets.
3. No protection against two staff booking the same day at the same moment. The shop has 6-7
   staff; check before write is enough.
4. Week runs Monday to Sunday (Asia/Bangkok).
5. Staff can book up to 2 weeks ahead.

## Sheet `Attendance`

Column order = physical order.

```text
id | staff_id | work_date | status | notes
created_at | created_by | updated_at | updated_by | deleted_at | deleted_by
```

- `work_date`: `yyyy-MM-dd`. Timestamps: `yyyy-MM-dd HH:mm:ss` (see `docs/conventions/datetime.md`).
- `status`: `DAY_OFF` (weekly day off, counts toward quota), `LEAVE` (sick/personal, type in
  `notes`, no quota), `ABSENT` (set by admin only).
- Every rule and report ignores rows where `deleted_at` is set.
- Writes: append and update; no hard delete.

## Day-off rules

- A date can have at most 1 active `DAY_OFF` row.
- A staff member can have at most 1 active `DAY_OFF` row per Monday-Sunday week.
- Bookable dates: tomorrow up to 14 days ahead.
- A staff member can have at most 1 active row (any status) per date.
- Create and update check these rules before writing. A failed check returns `409` with the reason.
- Staff can only book their own `DAY_OFF`. Everything else is admin only: record any status for any
  staff, edit, cancel.
- Cancel = set `deleted_at` / `deleted_by`. Staff cannot cancel or change their own booking.
- The tomorrow-to-14-days window applies to staff booking only. Admin may write any date, past
  included (leave and absence are often recorded after the day).
- Update can change `work_date`, `status` and `notes`. `staff_id` is fixed; to move a row to another
  staff member, cancel it and create a new one.
- On the shared device the actor is the scanned operator (`docs/features/staff/shared-device.md`).

## Phase 1 — day-off booking and admin records

Backend (mirror `server/modules/bag-items/` and `server/sheets/LaundryItems/`):
- `server/sheets/Attendance/Attendance.db-contract.ts` and `Attendance.repository.ts`
- `contracts/attendance/attendance-api.schema.ts`
- `server/modules/attendance/` with a service holding the rules above
- Register the module in `server/api/route-registry.ts`

```text
GET    /attendance?week=yyyy-MM-dd   active rows of that Monday-Sunday week, all statuses   everyone
POST   /attendance/day-off           book { workDate } as DAY_OFF for the acting staff      staff
POST   /attendance                   { staffId, workDate, status, notes? }                   admin
PATCH  /attendance/:id               { workDate?, status?, notes? }                          admin
DELETE /attendance/:id               cancel (soft delete)                                     admin
```

Frontend:
- `src/data/attendance/` service + store
- `src/features/attendance/` page: 7-day grid per week (free / mine / taken by name), week switcher
  limited to the bookable range for staff (admin: any week), admin sees who has no day off yet
  and can add/edit/cancel any row (DAY_OFF, LEAVE, ABSENT)
- Nav link in `src/shared/components/NavSidebar.vue`

Tests: backend unit tests for every rule (on create and on update), staff cancel/edit/create-for-others
rejected, staff date window vs admin past date, admin cancel then rebook, update into an occupied
day, and week boundary (Sunday vs Monday).

## Phase 2 — attendance from WorkTransactions

- No check-in. A staff member worked on a date when they have `WorkTransactions` rows that day
  (`staffId`, day of `created_at`), the same rule as `src/features/staff/utils/staff-performance.ts`.
- Per day: worked / day off / leave / absent (admin) / no record.
- Use it for efficiency % in the staff KPI views.

## Open

- Days when nobody may take a day off (e.g. weekends) — none for now.
