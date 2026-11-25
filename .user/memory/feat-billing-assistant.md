# feat/billing-assistant

- Worktree: `C:\MagicwashGemini\webapp-vue-billing`, cut from `docs/magicwashai-reference` (contains its 3 docs commits).
- Plan: `docs/plans/billing-assistant.md`; webapp non-visual part + draft card built, gates green.
- MagicwashAI side committed locally in `C:\MagicwashAI` (billing agent + DM push), not pushed or rebuilt.
- Before deploy: fill 5 spreadsheet-ID envs in MagicwashAI `.env` (BEFORE_PHOTOS id from the G Drive registry), owner starts Docker, rebuild, live-probe the billing sandbox, one KLX billing turn.
- Order: MagicwashAI live first, then merge/push this branch (webapp lists `billing` as a team agent; an old AI would 404 its history).
- After merge: delete this branch, `docs/magicwashai-reference`, both worktrees and both memory files.
- Moved from MEMORY.md to make room: approve a test order to check the `TAG-...-TAG-PHOTO` ticket and its EARN row.
