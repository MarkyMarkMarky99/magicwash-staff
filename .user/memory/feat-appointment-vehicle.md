# `feat/appointment-vehicle`

- Adds one `Vehicle` column (R) to Appointments to assign a job to `VAN` or `MOTORCYCLE`; null = unassigned.
- Done: G Drive `Appointment.json`, `Appointments.db-contract.ts`, `appointment-api.schema.ts` (create nullish, update nullable optional, list/detail response nullable).
- Next: backend mapping + test fixtures, frontend form/store/card, docs — delegated to Codex.
- Blocker for live writes: Appointments sheet needs header `Vehicle` in R1 and grid widened to 18 columns (user).
