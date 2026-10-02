# feat/department-batch-advance

- Status: built 2026-10-02, pushed to Preview; owner to phone-test before merge.
- Owner rules: only the Pending and In Progress tabs update; ALL and Completed are read-only; confirm before every send; Start kept.
- Phone-check: scan then phone Back, Cancel in the confirm, and the confirm sitting above the scanner overlay.
- Phone-check: queued scans survive an app reload and are dropped once their tickets change status.
- `/api/job-tickets/scan` and its service stay in the code with no caller on this page; delete in a later pass.
- `AdvanceConfirmDialog` sets `#overlay-root` z-index while open; replace if a shared confirm dialog appears.
