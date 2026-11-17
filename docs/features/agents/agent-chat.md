# Agent chat

Agents are AI helpers staff chat with from the side menu entry "Agents". `register-customer` and `price-check` use the live MagicwashAI `chat` task. `order-tracking` still returns a canned reply. `appointments`, `washing` and `ironing` are shared team chats (see [Team agents](#team-agents)).

## Screens and routes

- `/agents` (`agent-list`): one row card per agent, avatar at the left edge, name, role line, description, chevron. Six agents: `register-customer` (น้องลงทะเบียน), `price-check` (น้องราคา), `order-tracking` (น้องติดตาม), and the team agents `appointments` (น้องนัดหมาย, admin only), `washing` (น้องซักผ้า) and `ironing` (น้องรีดผ้า), both for `admin` and `staff`. Each catalog entry has an optional `roles` list; an agent whose list excludes the signed-in role (every `device` account, for the team agents) is hidden from the list and its route redirects to the list.
- `/agents/:agentId` (`agent-chat`, `meta.parent = agent-list`): a full page with its own top bar (back, avatar, name, role, "End"). Back returns to the list through `useGoBack`. An unknown `agentId` replaces the route with the list. The page is excluded from `KeepAlive`; the history lives in the store, not the component.
- UI text is English; only staff messages, agent replies, agent names, greetings and suggestion chips stay in Thai. The not-saved notice shows once per device (localStorage `agent-chat-notice-seen`) and hides itself after 6 seconds. The thinking bubble reads "Thinking… (may take up to a few min)". The composer textarea hides its scrollbar.
- The chat shows the not-saved notice, an empty state with greeting and three suggestion chips, staff bubbles with up to three image thumbnails, agent bubbles with the avatar, a thinking bubble, an error bubble with "Retry", and a composer (attach up to three images, multi-line input, send disabled while thinking).
- "End" opens a confirm overlay; confirming clears that agent's chat and returns to the agent list.

## Proposal cards

An agent reply carries `proposal` and `warnings`; the card is chosen from the proposal shape.

- Customer draft (`customerName`, `phone`, `address`, `lineId`, `facebook`, `whatsapp`, `email`, `customerType`): "เปิดฟอร์มลูกค้า" opens the customer create route with the card's non-null values prefilled. Warnings show in orange.
- Price rows (`rows[]` of `itemCode`, `name`, `serviceType`, `priceGroup`, `unit`, `price`): a price table.
- Tracking (`orderId`, `customerName`, `statusLabel`, `steps[]`): a status timeline.

## Customer form prefill

The customer card emits its proposal through the message list to `AgentChatPage`. The page puts only non-null values for `customerName`, `phone`, `address`, `lineId`, `facebook`, `whatsapp`, `email`, and `customerType` into `src/shared/navigation/customer-create-prefill.ts`, then pushes `customerCreateRoute()`. No customer data enters the URL or history state.

The shared module holds one in-memory value: `setCustomerCreatePrefill(values)` replaces it and `takeCustomerCreatePrefill()` returns it once and clears it. Reloading loses it. The customer form consumes it on mount in create mode only, filling provided values only where the matching form field is empty. Edit mode ignores it. Both pages are excluded from KeepAlive. Staff review and save through the existing form validation and save button; the hand-off adds no validation or business logic. All eight keys exist in form state, including WhatsApp; customer type remains hidden in create mode and omitted from the existing create payload. See [Customer registration](../customers/registration.md).

## State

- `useAgentChatStore` (`src/features/agents/stores/agent-chat.store.ts`) holds one chat per agent in memory only: messages, thinking flag, draft text, draft images. No localStorage or IndexedDB (only the notice-seen flag uses localStorage).
- History survives leaving to the list and re-entering. It is cleared by "End" or a page reload.
- Each chat has `sessionId: string | null`, null until the first reply and sent with every later message; "End" resets it to null.
- "End" aborts an in-flight request for that agent; late replies are discarded.
- `SESSION_NOT_FOUND` clears the session and shows "The previous chat expired and a new one started. Tap Retry to send again.". Retry sends the failed message and images with no session ID. Other failures use the generic error bubble.
- The text input uses `:value` and `@input`, never `v-model`, so Thai IME composition works.

## Sending

`sendAgentMessage` prepares images and calls the shared `sendChat` wrapper with the configured AI gateway URL and Firebase token. An unconfigured gateway fails without a request. The webapp sends only the new message and new images, plus the returned session ID on later turns; it performs no customer lookup or price checking. Results supply the reply, proposal and top-level warnings; customer proposal inner warnings are omitted from the UI proposal.

Each screenshot is resized to at most 1080 px wide with proportional height and no height limit, then encoded as JPEG at quality 0.85. If larger than 4.5 MiB, it is re-encoded at quality 0.7. Files are named `image-<n>.jpg` and attached with role `reference`.

Only `order-tracking` keeps the approximately 2 s fake response and the exact `error` message trick for showing a generic error bubble.

## Team agents

`appointments`, `washing` and `ironing` are team agents: each is one shop-wide conversation that every allowed user sees, and the AI side keeps the history. All three share one implementation parameterized by `agentId` and differ only in catalog entry, allowed roles and gateway paths. Roles: `appointments` admin only; `washing` and `ironing` `admin` and `staff`. Each has the route `/agents/<agentId>` (`team-agent-chat`, component `TeamAgentChatRoute`, excluded from `KeepAlive`, which renders `TeamAgentChatPage` keyed by `agentId` so switching agents on the same route mounts a fresh page) and does not use `useAgentChatStore`. A user whose role is not allowed who opens the route is replaced to the agent list once the session has loaded. The speaker name on a staff message is the signed-in employee.

- State lives in `useTeamAgentStore(agentId)` (`src/data/team-agent/`), one Pinia store per agent, memory only, except the last-seen event ID in localStorage (`team-agent-last-seen-event:<agentId>`, per device, every access in try/catch). The old appointments key `appointments-agent-last-seen-event` is copied to the new key on first read and removed, so existing devices keep their read position. The calls go through `shared/ai-gateway/tasks/team-agent.ts` with a 20 s deadline: send (`POST /tasks/chat` with `input.agentId`, returns `{ accepted, turnId, eventId }` at once), history, image, reminders list, reminder cancel, notes, all under `/agents/<agentId>/...`.
- Opening the page loads the latest 200 events. Each shows the speaker name (staff name, "AI", or "System"); `action` events are compact lines with an OK / Failed / Unknown outcome chip; the action type is one of `create`, `reschedule`, `cancel`, `remind`, `reminder-cancelled`, `close`, `reopen`. Event text is plain Thai prose and is shown as received. An `action:<attemptId>:attempt` event is hidden once the matching `action:<attemptId>:result` event is present (`visibleEvents` in the store); every other event renders unchanged.
- Images: the composer uses the same picker, three-image limit and downscale as the other agents (`AgentComposer`, `downscaleScreenshot`). Send is multipart through `callAiTask` files with role `reference`; the message may be empty when images are attached. The optimistic bubble shows the local previews. History events with `images` show thumbnails in the message (same markup as `AgentMessageList`, no viewer). Each image is fetched from `GET /agents/<agentId>/images/:id` with the Bearer token as a Blob, held as an object URL cached per image id, and revoked when the chat page closes.
- Sending shows an optimistic staff bubble, posts, then polls. The bubble is dropped once its `eventId` is in the history. A failed send removes the bubble, shows the error and puts the text back in the composer if it is empty. There is no auto-retry.
- Polling fetches only events after the last known event ID: on window focus, after a send, and every 15 s while the page is open. While history reports `busy` the list ends with a quiet "Working…" row.
- No End button, no clear or session reset, no "not saved" notice. The bar's "Reminders" button opens a panel: pending reminders (due time, note, created-at) each with Cancel, and the AI's notes read-only (file name and content), both reloaded on open.
- Unread badge: `src/App.vue` provides `agentsUnreadKey` (`src/shared/agents-unread.ts`) from `useAgentsUnread`, which polls every 60 s each team agent the signed-in role can see (nothing for `device` or signed-out). Each agent counts events after its own last-seen ID; the "Agents" menu entry shows the sum over visible agents only. A device with no stored ID starts from the latest event (no badge for old history). An agent's count clears when its chat page shows the latest event.

## Verification

Run the chat wrapper test with `npx tsx tests/shared/ai-gateway/chat.dry-test.ts`. Run the Pinia workflow test with `npx tsx --tsconfig jsconfig.json --experimental-test-module-mocks tests/web/unit/features/agents/stores/agent-chat.store.dry-test.ts` (Node 22 module mocking isolates gateway configuration). Run the team-agent endpoint wrapper test with `npx tsx tests/shared/ai-gateway/team-agent.dry-test.ts`, its store test with `npx tsx --tsconfig jsconfig.json --experimental-test-module-mocks tests/web/unit/data/team-agent/team-agent.store.dry-test.ts`, and the catalog role test with `npx tsx --tsconfig jsconfig.json tests/web/unit/features/agents/agents.dry-test.ts`. All use fake fetch responses and make no live service calls.
