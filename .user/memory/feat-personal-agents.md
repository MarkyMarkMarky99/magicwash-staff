# feat/personal-agents

- Personal assistant per employee + admin assignments; plan `docs/plans/personal-agents.md`.
- Paired MagicwashAI branch of the same name (C:\MagicwashAI); merge both together.
- Built and live-tested 2026-11-18 against an isolated AI test container (`docker compose -p magicwash-ai-test`, port 3111) and local vite on 3102 (`.user/personal-agents-test/vite.test.config.js`, launch config `vercel-ai-test`).
- Owner is testing before merge; nothing merged.
- Test setup cleanup: stop the 3111 container before 08:00 (its fixed agents run daily jobs); restore `.env.local` VITE_AI_GATEWAY_URL from the scratchpad backup.
- After merge: staff scores work only once prod W allows service-key `GET /api/work-transactions`.
- Not yet seen live: Cancel tile on an open assignment card, Overdue pill, failed-deliveries badge.
