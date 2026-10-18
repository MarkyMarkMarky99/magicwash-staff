# feat/shared-device-operator

- Worktree: `.worktrees/shared-device-operator`; brief in `.user/briefs/shared-device-operator.md`; feature doc `docs/features/staff/shared-device.md`.
- State: all work in one WIP commit on top of `ffeec09`; `main` is 13 commits ahead, not merged yet.
- Verification so far: typecheck + vite build pass; dry tests 256/267, the 11 failures also fail on HEAD (`.user/verification/shared-device-operator/report.md`).

## Pending
- Merge `main`: expect conflicts in `job-ticket.module.ts`, `DepartmentWorkPage.vue`, `job-ticket.module.dry-test.ts`.
- Create the device Staff row (role `device`) and its Google account.
- Rework to owner decision 2026-10-19: card QR = `MWS-<StaffId>`, fixed, never reissued; drop the `CardCode` column read, `issue-card` API and its tests; lookup parses the StaffId. No admin card UI.
- Change row 3 (magicwashth@gmail.com) role to `device` only after this branch deploys; main rejects `device`.
- Not yet tested: live sheet writes, Vercel deploy/ESM, a real barcode gun session.

## Open decisions
- Server trusts the `X-Operator-Id` header (active StaffId only); it does not prove a card was scanned.
