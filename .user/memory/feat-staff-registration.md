# feat/staff-registration

## Status

- Staff self-registration + admin approval built (`4f3eef8`); owner browser-tested 2026-10-03.
- Actor now records the signed-in StaffId (`unknown` when signed out, `?by=` ignored); owner tested on localhost 2026-10-03.
- Staff list (`GET /api/staff`) is public and prefetched in `App.vue`; `useStaffStore().nameOf(id)` maps id → name.
- Pushed to origin (`f275ade`); not merged to main.
- Owner's own row: StaffId `b8624701`, role admin.
- Feature doc: `docs/features/staff/registration.md`; backend: `docs/architecture/backend/operations.md` (auth section).

## Next

- No screen displays actors by name yet; use `nameOf` when work history / attendance screens are built.
- Deferred to a later round: server-owned invoice and payment writes still record `'admin'` (`server/shared/config/actor.ts`); needs actor from the client or token gating.
- Never rename existing actor columns (`createdBy`, `scannedBy`, …); change only what is written.

## Known

- Approval can take up to 60 s on another server instance (allowlist cache).
- A Sheets write rejection surfaces as a generic 500 "Internal server error".
