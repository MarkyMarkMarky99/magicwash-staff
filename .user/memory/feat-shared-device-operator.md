# feat/shared-device-operator

- Worktree: `.worktrees/shared-device-operator`; brief in `.user/briefs/shared-device-operator.md`; feature doc `docs/features/staff/shared-device.md`.
- State: all work in one WIP commit on top of `ffeec09`; `main` is 13 commits ahead, not merged yet.
- Verification so far: typecheck + vite build pass; dry tests 256/267, the 11 failures also fail on HEAD (`.user/verification/shared-device-operator/report.md`).

## Pending
- Merge `main`: expect conflicts in `job-ticket.module.ts`, `DepartmentWorkPage.vue`, `job-ticket.module.dry-test.ts`.
- Owner: add `CardCode` column to the Staff sheet, after the contract deploys (card issuance fails without it).
- Create the device Staff row (role `device`) and its Google account.
- No staff-page UI calls `POST /api/staff/issue-card/:staffId` yet.
- Not yet tested: live sheet writes, Vercel deploy/ESM, a real barcode gun session.

## Open decisions
- Server trusts the `X-Operator-Id` header (active StaffId only); it does not prove a card was scanned.
- Card lookup does not enforce the `MWS-` prefix server-side; only the frontend scanner routes by prefix.
