# feat/agent-chat

- `/agents` list + `/agents/:agentId` chat; doc `docs/features/agents/agent-chat.md`.
- register-customer and price-check call MagicwashAI task `chat` via `shared/ai-gateway/tasks/chat.ts`; order-tracking still uses the canned fake in `agent-chat.service.ts`.
- Owner tested locally on `vercel dev` :3000 against MagicwashAI :3110 (needs `ALLOWED_ORIGINS` to include `http://localhost:3000`).
- Card "เปิดฟอร์มลูกค้า" prefills the customer create form via in-memory `src/shared/navigation/customer-create-prefill.ts`; "จบงาน" clears and returns to the list.
- Next: build MagicwashAI `order-tracking` agent; align the tracking proposal shape (`orderId`, `customerName`, `statusLabel`, `steps[]`, invented by the UI pass).
- Before merge: prod needs `VITE_AI_GATEWAY_URL` on Vercel and MagicwashAI running via `start.bat`.
