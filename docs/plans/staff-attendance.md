# Plan — staff attendance and day-off booking

Status: **planned, not built.** When phase 1 ships, move the rules below into
`docs/features/staff/attendance.md` and keep this file as build history.

## Goal

Staff pick their own weekly day off in the app instead of the owner fitting days by hand.
The same sheet later holds check-in/check-out for attendance and KPI efficiency %.

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
id | staff_id | work_date | status | check_in_at | check_out_at | notes
created_at | created_by | updated_at | updated_by | deleted_at | deleted_by
```

- `work_date`: `yyyy-MM-dd`. Timestamps: `yyyy-MM-dd HH:mm:ss` (see `docs/conventions/datetime.md`).
- `status`: `DAY_OFF` (weekly day off, counts toward quota), `LEAVE` (sick/personal, type in
  `notes`, no quota), `PRESENT`, `ABSENT` (set by admin only).
- Every rule and report ignores rows where `deleted_at` is set.
- Writes: append and update; no hard delete.

## Day-off rules

- A date can have at most 1 active `DAY_OFF` row.
- A staff member can have at most 1 active `DAY_OFF` row per Monday-Sunday week.
- Bookable dates: tomorrow up to 14 days ahead.
- Booking checks both rules, then appends. A failed check returns `409` with the reason.
- Cancel = set `deleted_at` / `deleted_by`. Admin can cancel or assign any day.
- On the shared device the actor is the scanned operator (`docs/features/staff/shared-device.md`).

## Phase 1 — day-off booking

Backend (mirror `server/modules/bag-items/` and `server/sheets/LaundryItems/`):
- `server/sheets/Attendance/Attendance.db-contract.ts` and `Attendance.repository.ts`
- `contracts/attendance/attendance-api.schema.ts`
- `server/modules/attendance/` with a service holding the two rules
- Register the module in `server/api/route-registry.ts`

```text
GET    /attendance/day-off?week=yyyy-MM-dd   week grid: who is off on each day
POST   /attendance/day-off                   book { workDate } for the acting staff
DELETE /attendance/day-off/:id               cancel (own row, or admin any row)
POST   /attendance/day-off/assign            admin books { staffId, workDate }
```

Frontend:
- `src/data/attendance/` service + store
- `src/features/attendance/` page: 7-day grid per week (free / mine / taken by name), week switcher
  limited to the bookable range, admin sees who has no day off yet
- Nav link in `src/shared/components/NavSidebar.vue`

Tests: backend unit tests for both rules, cancel then rebook, and week boundary (Sunday vs Monday).

## Phase 2 — check-in / check-out

- Check-in creates or updates today's row to `PRESENT` with `check_in_at`.
- Check-in on a `DAY_OFF` date soft-deletes the day-off row and creates a `PRESENT` row.
- How staff check in is not decided (scan `MWS-` card on the shared device is the simplest).

## Phase 3 — KPI

- Use `Attendance` for efficiency % in the staff KPI views.

## Open

- Cancel deadline for staff (how many days before the date).
- Days when nobody may take a day off (e.g. weekends) — none for now.
