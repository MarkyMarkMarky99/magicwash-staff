# feat/direct-chat

- Plan: `docs/plans/direct-chat.md`; web behaviour: `docs/features/agents/direct-chat.md`.
- Worktree: `C:\MagicwashGemini\webapp-vue-chat`; MagicwashAI side is committed on its local `main`.
- MagicwashAI containers already run the new `/direct`, `/preferences` and translation (`DIRECT_TRANSLATION_ENABLED=1`).
- Not done: a real send (text + image) between two staff, then push to `main`.
- Not done: push notifications for DMs (wait for the shared-phone sign-out/account-switch test).
- Cosmetic: empty divider under the Secretary switch when it is off (reported, not fixed).
- Preferences migrated for 4 staff; everyone else defaults to Thai until an admin sets it.
