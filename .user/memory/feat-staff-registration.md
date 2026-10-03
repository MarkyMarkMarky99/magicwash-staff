# feat/staff-registration

- Status: built and browser-tested by owner 2026-10-03 (register → pending → admin approve); not pushed.
- Next: push/merge decision; then decide API gating and signed-in actor (open in MEMORY.md Auth section).
- Sheet: `Staff` needs the service account as Editor (done by owner); registry `Staff.json` updated with E–I columns.
- Known: approval can take up to 60 s on another server instance (allowlist cache).
- Known: a Sheets write rejection surfaces as a generic 500 "Internal server error".
