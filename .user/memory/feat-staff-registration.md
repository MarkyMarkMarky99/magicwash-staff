# feat/staff-registration

## Status

- Staff self-registration + admin approval built; commit `4f3eef8`; not pushed.
- Owner browser-tested 2026-10-03: register → pending → admin approves at `/staff` → login works.
- Owner's own row: StaffId `b8624701`, role admin.
- Sheet `Staff` (cols A–I): service account `magicwash-staff-writer@…` is Editor; registry `Staff.json` updated.
- Feature doc: `docs/features/staff/registration.md`; backend: `docs/architecture/backend/operations.md` (auth section).

## Next task: replace hardcoded `admin` actor

- Source of the fallback: `src/shared/config/actor.ts` (`currentActor(override)` → `?by=` or `'admin'`).
- 14 callers: grep `config/actor` under `src/` (appointments, work-orders, customers, customer-packages, packages, gallery, orders, job-tickets).
- Signed-in staff is available in `useAuthStore()` (`staff`, `status`); only `signedIn` users have a usable identity.
- Open decision for owner: record **StaffId** (Claude's recommendation) or **Name**.
  - StaffId: stable and unique, matches planned attendance records; UI maps id → name, falling back to the raw value for old rows (`admin`, names).
  - Name: simpler, readable in the sheet, but history breaks when a name is edited.
- Open question: keep `?by=` (AppSheet deep links) as an override, or drop it.
- Open question: client-sent actor vs server deriving it from the token; other modules are still unauthenticated, so server-side needs gating first.
- Never rename existing actor columns (`createdBy`, `scannedBy`, …); change only what is written.

## Known

- Approval can take up to 60 s on another server instance (allowlist cache).
- A Sheets write rejection surfaces as a generic 500 "Internal server error".
