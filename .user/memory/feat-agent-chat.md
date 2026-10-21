# feat/agent-chat

- UI only: `/agents` list + `/agents/:agentId` chat, built from `.user/agent-chat-design/agent-chat.html`; doc `docs/features/agents/agent-chat.md`.
- Fake replies live only in `src/features/agents/services/agent-chat.service.ts`; integration replaces that file with a `callAiTask('chat', ...)` call (multipart, files role `reference`).
- MagicwashAI side (C:\MagicwashAI): task `chat` with resumable Codex sessions; agents `register-customer`, `price-check` done; `order-tracking` not built.
- Webapp stays thin: it sends `{ agentId, message, sessionId? }` + images and renders `reply`/`proposal`/`warnings`; all data fetch and verification stays in MagicwashAI.
- Tracking proposal shape (`orderId`, `customerName`, `statusLabel`, `steps[]`) was invented by the UI pass; align it when the agent is built.
- Next: build `order-tracking` agent, then wire the service to MagicwashAI and handle `SESSION_NOT_FOUND` by starting a new chat.
- "เปิดฟอร์มลูกค้า" opens the create form without prefill; prefill from the proposal is not built.
