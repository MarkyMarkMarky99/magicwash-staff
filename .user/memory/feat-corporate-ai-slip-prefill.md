# feat/corporate-ai-slip-prefill

- Corporate form keeps one slip photo; the AI reading prefills counts, added lines and received date.
- Client in `shared/ai-gateway/`, schemas in `contracts/ai-gateway/`, frontend glue in `src/shared/ai-gateway/`.
- Owner verified every mode in the browser against `scripts/mock-ai-gateway/server.mjs` (2026-10-21).
- AI is off unless `VITE_AI_GATEWAY_URL` is set; production stays off until integration.
- Next: integration with the real gateway through Cloudflare, then a Preview deploy (root `shared/` imports need `.js`).
- Design and decisions: `.user/memory/magicwash-ai-gateway-handoff.md`.
