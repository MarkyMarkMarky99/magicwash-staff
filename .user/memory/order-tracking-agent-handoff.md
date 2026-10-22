# Handoff — order-tracking agent (น้องติดตาม), next session

## Goal
- Staff asks in `/agents/order-tracking` by order number or customer phone; the agent answers the order's current status.
- Replace the canned fake reply in `src/features/agents/services/agent-chat.service.ts` with the real MagicwashAI call.

## Owner rules (do not break)
- All AI work lives in MagicwashAI (`C:\MagicwashAI`, local PC): data fetch, prompt, verification. webapp-vue only sends `{ agentId, message, sessionId? }` + images and renders `reply` / `proposal` / `warnings`.
- Say "MagicwashAI", not "gateway".
- Code is written by Codex via the `implement` skill; one Codex job at a time; review every diff line; commit only after the owner tests.
- Test MagicwashAI by firing real requests first (curl / service secret), webapp second.

## What already exists (read, don't rebuild)
- MagicwashAI task `chat` with resumable Codex sessions: `src/tasks/chat/task.js`, shared rules `src/tasks/chat/instruction.md`, agent list `src/tasks/chat/agents/index.js`.
- Agent folder pattern: `src/tasks/chat/agents/<id>/agent.js` (`proposalSchema`, `prepare`, `promptContext`, `checkProposal(proposal, context)`) + `instruction.md`.
- Copy `price-check` for the data-loading pattern: `prepare` runs every turn, `promptContext` only on the first turn, `checkProposal` re-checks the model's output against fresh data.
- GViz reader: `src/sheets/gviz.js`; date cells come back as `Date(y,m0,d)` → `normalizeSheetDate` in `src/sheets/price-list.js`.
- Webapp wiring: `shared/ai-gateway/tasks/chat.ts`, `contracts/ai-gateway/chat-api.schema.ts` (agentId enum and proposal union must gain order-tracking).
- UI card already built: `src/features/agents/components/TrackingProposalCard.vue`; its shape (`orderId`, `customerName`, `statusLabel`, `steps[{label, detail, state: done|current|upcoming}]`) was invented by the UI pass — align it with what MagicwashAI returns.

## Open design (decide with owner before dispatch)
- Data source: registry `G:\My Drive\Magicwash\Database\GoogleSheets\Order.json` (`ORDERS_SPREADSHEET_ID`: order_number, status, received_date, due_date, customer…) and `JobTicket.json` (`JOB_TICKETS_SPREADSHEET_ID`: order_id, department, step_no, status, started_at, completed_at). Check link-viewable sharing for GViz from MagicwashAI.
- Lookup by phone needs Customers (`CUSTOMERS_SPREADSHEET_ID`); decide whether MagicwashAI reads Customers too.
- Loading whole sheets every turn may be slow (JobTickets grows); consider filtering in MagicwashAI before the prompt, or look up the order in code and send only that order to Codex.
- The order status sequence itself is still undecided (see MEMORY "Garment tracking"); show raw department/ticket status rather than inventing stages.
- Never let Codex invent statuses: `checkProposal` must rebuild the card from sheet data.

## Prod state after merge 67d303a9 (2026-10-22)
- order-tracking shows fake data (ORD-1042) in prod until this agent ships; owner was offered hiding it.
- MagicwashAI must run via `start.bat` on :3110 (tunnel `ai.magicwash-laundry.com`); for local `vercel dev` add `http://localhost:3000` to `ALLOWED_ORIGINS`.
